import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../data/offline/download_manager.dart';
import '../../data/offline/offline_store.dart';
import '../../data/repositories/audio_repository.dart';
import '../../data/repositories/stories_repository.dart';
import '../../state/app_state.dart';
import '../../models/models.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';
import '../../widgets/sheets.dart';

/// True nếu truyện có audiobook (ít nhất 1 chương có audio).
bool bookHasAudio(List<Chapter> chapters) => chapters.any((c) => c.hasAudio);

class BookDetailScreen extends StatefulWidget {
  const BookDetailScreen({super.key, required this.bookId});
  final String bookId;

  @override
  State<BookDetailScreen> createState() => _BookDetailScreenState();
}

class _BookDetailScreenState extends State<BookDetailScreen> {
  bool _allChapters = false;
  late final Future<StoryDetail> _future;

  @override
  void initState() {
    super.initState();
    final repo = context.read<StoriesRepository>();
    _future = _load(repo);
  }

  /// Nạp chi tiết truyện THẬT từ backend theo slug. Lỗi → FutureBuilder hiện
  /// "Không tải được truyện" (không còn fallback demo).
  Future<StoryDetail> _load(StoriesRepository repo) => repo.detail(widget.bookId);

  /// Nghe audiobook: phát HLS chương đầu (ưu tiên Cloudflare) hoặc resolve proxy
  /// 302. Không có audio thật → báo cho người dùng (không phát demo).
  Future<void> _listen(BuildContext context, Book book, List<Chapter> chapters) async {
    final app = context.read<AppState>();
    final ch = chapters.where((c) => c.id.isNotEmpty).isNotEmpty
        ? chapters.firstWhere((c) => c.id.isNotEmpty)
        : (chapters.isNotEmpty ? chapters.first : null);
    if (ch != null) {
      // Đã tải offline → phát file trên đĩa, không cần mạng.
      if (ch.id.isNotEmpty) {
        final store = context.read<OfflineStore>();
        final localPath = store.audioPath(book.id, ch.id);
        if (localPath != null) {
          await app.playLocalAudiobook(book, ch, localPath);
          if (context.mounted) context.push('/audiobook');
          return;
        }
      }
      // Ưu tiên HLS Cloudflare (stream + preload 30s); không cần resolve proxy.
      if (ch.hlsUrl.isNotEmpty) {
        app.play('${book.title} • Ch.${ch.n}', book.author, book.cover, ch.hlsUrl);
        context.push('/audiobook');
        return;
      }
      if (ch.id.isNotEmpty) {
        try {
          final url = await context.read<AudioRepository>().chapterAudioUrl(ch.id);
          if (!context.mounted) return;
          if (url != null && url.isNotEmpty) {
            app.play('${book.title} • Ch.${ch.n}', book.author, book.cover, url);
            context.push('/audiobook');
            return;
          }
        } on ApiException catch (e) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Không phát được: ${e.message}')));
          }
          return;
        } catch (_) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không phát được audio')));
          }
          return;
        }
      }
    }
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Truyện chưa có audio')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.arrow_back, color: pal.ink), onPressed: () => context.pop()),
      ),
      body: FutureBuilder<StoryDetail>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(color: AppPalette.terracotta));
          }
          if (!snap.hasData) {
            return Center(child: Text('Không tải được truyện', style: AppType.body(size: 14, color: pal.muted)));
          }
          return _body(context, snap.data!.book, snap.data!.chapters);
        },
      ),
    );
  }

  // Bình luận demo (BE chưa có API comment cho app — trang trí theo thiết kế anh/2/2.png).
  Widget _body(BuildContext context, Book book, List<Chapter> chapters) {
    final pal = context.pal;
    final app = context.watch<AppState>();
    final shown = _allChapters ? chapters : chapters.take(5).toList();
    final locked = chapters.where((c) => c.state == ChapterState.coin || c.state == ChapterState.vip).length;
    return ListView(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 0, Gap.screenH, Gap.xxl),
        children: [
          // ── Header: cover + tên + phụ đề + tác giả ──
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 118, child: CoverImage(path: book.cover, title: book.title, radius: Radii.cover)),
              const SizedBox(width: Gap.lg),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: Gap.xs),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(book.title, style: AppType.hero(size: 23, color: pal.ink)),
                      if (book.subtitle.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(book.subtitle, style: AppType.serif(size: 15, height: 1.25, color: pal.muted).copyWith(fontStyle: FontStyle.italic)),
                      ],
                      const SizedBox(height: 8),
                      Text('by ${book.author}', style: AppType.meta(size: 13, color: pal.soft)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: Gap.lg),

          // ── 4 thẻ chỉ số (Rating / Reads / Chapters / Status) ──
          Row(children: [
            Expanded(child: GestureDetector(
              onTap: () => showRatingSheet(context, book.title),
              child: _statCard(context, '⭐ ${book.rating}', 'Rating'),
            )),
            const SizedBox(width: Gap.sm),
            Expanded(child: _statCard(context, book.reads, 'Reads')),
            const SizedBox(width: Gap.sm),
            Expanded(child: _statCard(context, '${book.chapters}', 'Chapters')),
            const SizedBox(width: Gap.sm),
            Expanded(child: _statCard(context, book.status, 'Status', valueColor: pal.sage)),
          ]),
          const SizedBox(height: Gap.md),

          // ── Chips thể loại ──
          Wrap(spacing: Gap.sm, runSpacing: Gap.sm, children: [
            if (book.genre.isNotEmpty) _genreChip(context, book.genre),
            if (book.trope.isNotEmpty) _genreChip(context, book.trope),
          ]),
          const SizedBox(height: Gap.lg),

          // ── Synopsis ──
          _synopsis(context, book),
          const SizedBox(height: Gap.lg),

          // ── CTA Read Now / Listen Now ──
          if (bookHasAudio(chapters))
            Row(children: [
              Expanded(child: _cta(context, 'Read Now', null, AppPalette.terracotta, () => context.push('/reader/${book.id}'))),
              const SizedBox(width: Gap.md),
              Expanded(child: _cta(context, 'Listen Now', Icons.play_arrow_rounded, AppPalette.plum, () => _listen(context, book, chapters))),
            ])
          else
            _cta(context, 'Read Now', null, AppPalette.terracotta, () => context.push('/reader/${book.id}')),
          const SizedBox(height: Gap.sm),
          _downloadButton(context, book),
          const SizedBox(height: Gap.md),

          // ── Bundle: mở khoá toàn bộ (chỉ khi truyện có giá thật) ──
          if (book.unlockPrice > 0) ...[
            _bundleCard(context, book, locked),
            const SizedBox(height: Gap.xl),
          ] else
            const SizedBox(height: Gap.lg),

          // ── Chapters ──
          Text('Chapters', style: AppType.hero(size: 20, color: pal.ink)),
          const SizedBox(height: Gap.md),
          Container(
            decoration: BoxDecoration(color: pal.card, borderRadius: rounded(18), border: Border.all(color: pal.line)),
            clipBehavior: Clip.antiAlias,
            child: Column(children: [
              for (var i = 0; i < shown.length; i++) ...[
                if (i > 0) _divider(pal),
                _chapterRow(context, book, shown[i], app),
              ],
              if (!_allChapters && chapters.length > shown.length) ...[
                _divider(pal),
                InkWell(
                  onTap: () => setState(() => _allChapters = true),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Center(
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Text('Xem tất cả ${book.chapters} chương', style: AppType.btn(size: 14, color: AppPalette.terracotta)),
                        const SizedBox(width: 4),
                        const Icon(Icons.keyboard_arrow_down_rounded, size: 20, color: AppPalette.terracotta),
                      ]),
                    ),
                  ),
                ),
              ],
            ]),
          ),
        ],
      );
  }

  Widget _statCard(BuildContext context, String value, String label, {Color? valueColor}) {
    final pal = context.pal;
    return Container(
      height: 62,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(color: pal.card, borderRadius: rounded(14), border: Border.all(color: pal.line)),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 15, color: valueColor ?? pal.ink)),
        const SizedBox(height: 2),
        Text(label, style: AppType.meta(size: 11, color: pal.muted)),
      ]),
    );
  }

  Widget _genreChip(BuildContext context, String label) {
    final pal = context.pal;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(color: pal.surf, borderRadius: rounded(20)),
      child: Text(label, style: AppType.btn(size: 12.5, color: pal.amber)),
    );
  }

  Widget _synopsis(BuildContext context, Book book) {
    final pal = context.pal;
    // Không có mô tả thật → ẩn hẳn khối synopsis (không dùng text demo).
    if (book.synopsis.trim().isEmpty) return const SizedBox.shrink();
    final text = book.synopsis;
    return RichText(
      text: TextSpan(
        style: AppType.body(size: 14.5, color: pal.soft).copyWith(height: 1.55),
        children: [
          TextSpan(text: '$text  '),
          TextSpan(
            text: 'Read More',
            style: AppType.btn(size: 14.5, color: AppPalette.terracotta),
            recognizer: (TapGestureRecognizer()..onTap = () => _showSynopsis(context, book.title, text)),
          ),
        ],
      ),
    );
  }

  void _showSynopsis(BuildContext context, String title, String text) {
    final pal = context.pal;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: pal.bg2,
      showDragHandle: true,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 0, Gap.screenH, Gap.xxl),
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(title, style: AppType.hero(size: 20, color: pal.ink)),
            const SizedBox(height: Gap.md),
            Text(text, style: AppType.body(size: 14.5, color: pal.soft).copyWith(height: 1.6)),
          ]),
        ),
      ),
    );
  }

  Widget _cta(BuildContext context, String label, IconData? icon, Color color, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          height: 54,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: color, borderRadius: rounded(16)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[Icon(icon, size: 22, color: Colors.white), const SizedBox(width: 6)],
            Text(label, style: AppType.btn(size: 15.5, color: Colors.white)),
          ]),
        ),
      );

  Widget _downloadButton(BuildContext context, Book book) {
    final pal = context.pal;
    final dm = context.watch<DownloadManager>();
    final store = context.read<OfflineStore>();
    final p = dm.progress[book.id];
    final rec = store.download(book.id);
    final done = rec?.kind == 'downloaded' && rec?.status == 'complete';

    if (p != null && p.status == 'downloading') {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Đang tải ${p.done}/${p.total} chương…', style: AppType.meta(size: 12.5, color: pal.muted)),
        const SizedBox(height: 6),
        ClipRRect(borderRadius: rounded(6), child: LinearProgressIndicator(value: p.fraction, color: AppPalette.terracotta, backgroundColor: pal.surf2)),
      ]);
    }
    if (done) {
      return Row(children: [
        Icon(Icons.download_done_rounded, size: 18, color: pal.sage),
        const SizedBox(width: 6),
        Text('Đã tải offline', style: AppType.item(size: 13, color: pal.sage)),
        const Spacer(),
        TextButton(onPressed: () async { await store.deleteStory(book.id); setState(() {}); },
          child: Text('Xoá', style: AppType.btn(size: 13, color: AppPalette.terracotta))),
      ]);
    }
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () => dm.downloadStory(book.id),
        icon: const Icon(Icons.download_rounded, size: 18),
        label: const Text('Tải xuống để đọc offline'),
      ),
    );
  }

  Widget _bundleCard(BuildContext context, Book book, int locked) {
    final pal = context.pal;
    final sub = [
      if (locked > 0) '$locked locked chapters',
      if (book.discountPercent > 0) 'save ${book.discountPercent}%',
    ].join(' · ');
    return InkWell(
      borderRadius: rounded(16),
      onTap: () => context.push('/wallet'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.md),
        decoration: BoxDecoration(color: pal.accentSurf, borderRadius: rounded(16), border: Border.all(color: pal.line)),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Unlock All · Buy Bundle', style: AppType.item(size: 15, color: AppPalette.terracotta)),
              if (sub.isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(sub, style: AppType.meta(size: 12.5, color: pal.soft)),
              ],
            ]),
          ),
          const SizedBox(width: Gap.sm),
          Container(width: 22, height: 22, decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [AppPalette.coinA, AppPalette.coinB]))),
          const SizedBox(width: 8),
          Text('${book.unlockPrice}', style: AppType.hero(size: 18, color: pal.ink)),
        ]),
      ),
    );
  }

  Widget _divider(AppPalette pal) => Divider(height: 1, thickness: 1, color: pal.line2);

  Widget _chapterRow(BuildContext context, Book book, Chapter c, AppState app) {
    final pal = context.pal;
    final unlocked = app.isUnlocked(book.id, c.n);
    final locked = (c.state == ChapterState.coin || c.state == ChapterState.vip) && !unlocked;
    final (badge, badgeColor, bg) = switch (c.state) {
      ChapterState.free => ('FREE', pal.sage, pal.sageSurf),
      ChapterState.vip => (unlocked ? 'VIP' : '🔒 VIP', AppPalette.terracotta, pal.accentSurf),
      ChapterState.current => ('NOW', AppPalette.plum, pal.plumSurf),
      ChapterState.coin => (unlocked ? '✓' : '🪙 ${c.price}', pal.amber, pal.surf2),
    };
    return InkWell(
      onTap: () async {
        if (locked) {
          final ok = await showUnlockSheet(context, book, c);
          if (ok && context.mounted) context.push('/reader/${book.id}?ch=${c.n}');
        } else {
          context.push('/reader/${book.id}?ch=${c.n}');
        }
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: 15),
        child: Row(
          children: [
            SizedBox(width: 34, child: Text('${c.n}', style: AppType.item(size: 15, color: pal.muted))),
            Expanded(child: Text(c.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.body(size: 15, w: FontWeight.w500, color: pal.ink))),
            const SizedBox(width: Gap.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: bg, borderRadius: rounded(8)),
              child: Text(badge, style: AppType.tabLabel(color: badgeColor)),
            ),
          ],
        ),
      ),
    );
  }

}
