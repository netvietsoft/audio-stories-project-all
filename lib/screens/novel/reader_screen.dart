import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollDirection;
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../data/reader/reader_store.dart';
import '../../data/reader/reader_models.dart';
import '../../data/repositories/audio_repository.dart';
import '../../data/repositories/stories_repository.dart';
import '../../l10n/l10n_ext.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/sheets.dart';

/// Màn ĐỌC truyện (thiết kế readding/set trang/nghe truyện/cuoi trang).
/// AppBar: nghe / bookmark / Aa (settings chi tiết) / danh sách chương.
/// Menu dưới 4 tab tự ẩn khi cuộn xuống, hiện khi cuộn lên; thanh read-along khi nghe.
class ReaderScreen extends StatefulWidget {
  const ReaderScreen({super.key, required this.bookId, this.initialChapter});
  final String bookId;
  final int? initialChapter;

  @override
  State<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends State<ReaderScreen> {
  late int _chapter = widget.initialChapter ?? 1;
  bool _error = false; // tải chi tiết thất bại
  final _scroll = ScrollController();
  bool _chromeVisible = true; // menu dưới hiện/ẩn theo hướng cuộn
  Timer? _saveDebounce;
  bool _resumed = false;
  double? _pendingJumpOffset;

  // ── tuỳ chỉnh đọc (set trang.png) ──
  int _bg = 0; // 0 Cream · 1 White · 2 Sepia · 3 Dark · 4 OLED
  Color? _textColor; // null = Auto
  double _fontSize = 18;
  String _font = 'serif'; // serif · sans · dyslexia
  double _lineHeight = 1.6;
  String _margin = 'medium'; // narrow · medium · wide

  // ── dữ liệu ──
  late final StoriesRepository _repo;
  late final ReaderStore _reader;
  StoryDetail? _detail;
  String _content = '';
  bool _loading = true;
  bool _loadingContent = false;

  static const _bgs = [Color(0xFFFBF3E3), Color(0xFFFFFFFF), Color(0xFFF4E7CC), Color(0xFF15110C), Color(0xFF000000)];
  static const _inks = [Color(0xFF2A2118), Color(0xFF2A2118), Color(0xFF3A2E1C), Color(0xFFE8DCC4), Color(0xFFD8CCB4)];
  static const _bgLabels = ['Cream', 'White', 'Sepia', 'Dark', 'OLED'];
  static const _palette = [
    null, Color(0xFF2A2118), Color(0xFF5B4F3A), Color(0xFF8A5A2B), Color(0xFFC2683A),
    Color(0xFF4E6E58), Color(0xFF35506E), Color(0xFF7A5470), Color(0xFF9A3B4A),
  ];
  @override
  void initState() {
    super.initState();
    _repo = context.read<StoriesRepository>();
    _reader = context.read<ReaderStore>();
    final s = _reader.readSettings();
    _bg = s.bg;
    _textColor = s.textColor == null ? null : Color(s.textColor!);
    _fontSize = s.fontSize;
    _font = s.font;
    _lineHeight = s.lineHeight;
    _margin = s.margin;
    _scroll.addListener(_onScroll);
    _init();
  }

  @override
  void dispose() {
    _saveDebounce?.cancel();
    if (_scroll.hasClients) _reader.savePosition(widget.bookId, _chapter, _scroll.offset);
    _scroll.dispose();
    super.dispose();
  }

  // Cuộn xuống (đọc tiếp) → ẩn menu; cuộn lên → hiện.
  void _onScroll() {
    final dir = _scroll.position.userScrollDirection;
    if (dir == ScrollDirection.reverse && _chromeVisible) {
      setState(() => _chromeVisible = false);
    } else if (dir == ScrollDirection.forward && !_chromeVisible) {
      setState(() => _chromeVisible = true);
    }
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(seconds: 1), () {
      if (_scroll.hasClients) _reader.savePosition(widget.bookId, _chapter, _scroll.offset);
    });
  }

  Future<void> _init() async {
    try {
      final detail = await _repo.detail(widget.bookId);
      if (!mounted) return;
      final nums = detail.chapters.map((c) => c.n).toList();
      if (nums.isNotEmpty && !nums.contains(_chapter)) _chapter = nums.first;
      if (widget.initialChapter == null) {
        final saved = _reader.position(widget.bookId);
        if (saved != null && detail.chapters.any((c) => c.n == saved.chapter)) {
          _chapter = saved.chapter;
        }
      }
      setState(() {
        _detail = detail;
        _loading = false;
      });
      await _loadContent();
    } catch (_) {
      if (mounted) setState(() { _loading = false; _error = true; });
    }
  }

  Future<void> _loadContent() async {
    if (!mounted) return;
    final chapters = _detail?.chapters ?? const [];
    final ch = chapters.firstWhere((c) => c.n == _chapter,
        orElse: () => chapters.isNotEmpty ? chapters.first : const Chapter(n: 1, title: '', state: ChapterState.free));
    final app = context.read<AppState>();
    final locked = _locked(app, ch);

    if (!locked) _recordLastRead(ch); // ghi "đọc gần nhất" THẬT cho Home

    if (ch.id.isNotEmpty && !locked) {
      setState(() => _loadingContent = true);
      try {
        final c = await _repo.chapterContent(ch.id);
        if (!mounted) return;
        _setContent(c.content.trim());
      } catch (_) {
        if (!mounted) return;
        _setContent('');
      }
      if (mounted) setState(() => _loadingContent = false);
    } else {
      _setContent('');
    }
    if (!_resumed) {
      _resumed = true;
      final saved = _reader.position(widget.bookId);
      if (saved != null && saved.chapter == _chapter && saved.offset > 0) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scroll.hasClients) {
            _scroll.jumpTo(saved.offset.clamp(0, _scroll.position.maxScrollExtent));
          }
        });
      }
    }
    if (_pendingJumpOffset != null) {
      final target = _pendingJumpOffset!;
      _pendingJumpOffset = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.jumpTo(target.clamp(0, _scroll.position.maxScrollExtent));
      });
    }
  }

  void _setContent(String text) => setState(() => _content = text);

  /// Lưu chương đang đọc để Home hiện Continue Reading đúng thực tế.
  void _recordLastRead(Chapter ch) {
    final b = _detail?.book;
    if (b == null) return;
    context.read<AppState>().setLastRead(
          bookId: b.id,
          title: b.title,
          cover: b.cover,
          chapter: ch.n,
          chapterTitle: ch.title,
          total: b.chapters,
        );
  }

  Future<void> _playChapterAudio(Book book, Chapter ch) async {
    final app = context.read<AppState>();
    if (ch.hlsUrl.isNotEmpty) {
      app.play('${book.title} • Ch.${ch.n}', book.author, book.cover, ch.hlsUrl);
      return;
    }
    if (ch.id.isNotEmpty) {
      try {
        final url = await context.read<AudioRepository>().chapterAudioUrl(ch.id);
        if (!mounted) return;
        if (url != null && url.isNotEmpty) {
          app.play('${book.title} • Ch.${ch.n}', book.author, book.cover, url);
          return;
        }
      } on ApiException catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Không phát được: ${e.message}')));
        return;
      } catch (_) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không phát được audio')));
        return;
      }
    }
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Chương chưa có audio')));
  }

  void _goChapter(int n, List<Chapter> chapters) {
    if (!chapters.any((c) => c.n == n)) return;
    setState(() {
      _chapter = n;
      _chromeVisible = true;
    });
    if (_scroll.hasClients) _scroll.jumpTo(0);
    _loadContent();
  }

  bool _locked(AppState app, Chapter c) =>
      (c.state == ChapterState.coin || c.state == ChapterState.vip) && !app.isUnlocked(widget.bookId, c.n);

  TextStyle _bodyStyle(Color ink) {
    if (_font == 'serif') return AppType.serif(size: _fontSize, color: ink, height: _lineHeight);
    // sans / dyslexia (chưa bundle OpenDyslexic → dùng sans Figtree)
    return AppType.body(size: _fontSize, color: ink).copyWith(height: _lineHeight);
  }

  double get _marginH => _margin == 'narrow' ? 14 : (_margin == 'wide' ? 34 : 20);

  String _snippetAtOffset() {
    final paras = _content.split(RegExp(r'\n\s*\n')).map((p) => p.trim()).where((p) => p.isNotEmpty).toList();
    if (paras.isEmpty) return '';
    // ước lượng đoạn theo tỉ lệ cuộn (đủ để nhận diện trong danh sách)
    final frac = (_scroll.hasClients && _scroll.position.maxScrollExtent > 0)
        ? (_scroll.offset / _scroll.position.maxScrollExtent).clamp(0.0, 1.0)
        : 0.0;
    final idx = (frac * (paras.length - 1)).round().clamp(0, paras.length - 1);
    final s = paras[idx];
    return s.length <= 60 ? s : '${s.substring(0, 60)}…';
  }

  void _toggleBookmark() {
    final list = _reader.bookmarks(widget.bookId);
    // Nếu đang ~trùng một bookmark (cùng chương, |offset| < 40) → xoá; ngược lại thêm.
    final off = _scroll.hasClients ? _scroll.offset : 0.0;
    final near = list.where((b) => b.chapter == _chapter && (b.offset - off).abs() < 40).toList();
    if (near.isNotEmpty) {
      _reader.removeBookmark(widget.bookId, near.first.savedAt);
    } else {
      _reader.addBookmark(widget.bookId, Bookmark(
        chapter: _chapter, offset: off, snippet: _snippetAtOffset(),
        savedAt: DateTime.now().millisecondsSinceEpoch));
    }
    setState(() {});
  }

  bool get _isBookmarkedHere {
    final off = _scroll.hasClients ? _scroll.offset : 0.0;
    return _reader.bookmarks(widget.bookId).any((b) => b.chapter == _chapter && (b.offset - off).abs() < 40);
  }

  void _persistSettings() {
    _reader.saveSettings(ReaderSettings(
      bg: _bg,
      textColor: _textColor?.toARGB32(),
      fontSize: _fontSize,
      font: _font,
      lineHeight: _lineHeight,
      margin: _margin,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final bg = _bgs[_bg];
    final ink = _textColor ?? _inks[_bg];
    if (_error) {
      return Scaffold(
        backgroundColor: bg,
        appBar: AppBar(backgroundColor: bg, elevation: 0, iconTheme: IconThemeData(color: ink)),
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.cloud_off, size: 44, color: ink.withValues(alpha: 0.5)),
            const SizedBox(height: 10),
            Text('Không tải được truyện', style: AppType.item(size: 14, color: ink)),
          ]),
        ),
      );
    }
    if (_loading || _detail == null) {
      return Scaffold(
        backgroundColor: bg,
        body: const Center(child: CircularProgressIndicator(color: AppPalette.terracotta)),
      );
    }
    final app = context.watch<AppState>();
    final book = _detail!.book;
    final chapters = _detail!.chapters;
    final ch = chapters.firstWhere((c) => c.n == _chapter, orElse: () => chapters.first);
    final locked = _locked(app, ch);
    final playingThis = app.nowPlayingTitle != null && app.nowPlayingTitle!.startsWith(book.title);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: bg,
        elevation: 0,
        iconTheme: IconThemeData(color: ink),
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(book.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 14, color: ink)),
            Text('Chapter ${ch.n} · ${ch.title}',
                maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 11, color: ink.withValues(alpha: 0.6))),
          ],
        ),
        actions: [
          IconButton(tooltip: 'Nghe', icon: Icon(Icons.headphones_outlined, color: ink), onPressed: locked ? null : () => _playChapterAudio(book, ch)),
          IconButton(tooltip: 'Đánh dấu', icon: Icon(_isBookmarkedHere ? Icons.bookmark : Icons.bookmark_border, color: ink), onPressed: _toggleBookmark),
          IconButton(tooltip: 'Tuỳ chỉnh đọc', icon: Text('Aa', style: AppType.serif(size: 18, w: FontWeight.w700, color: ink)), onPressed: _openSettings),
          IconButton(tooltip: 'Danh sách chương', icon: Icon(Icons.menu, color: ink), onPressed: () => _openChapterList(chapters)),
        ],
      ),
      body: Stack(
        children: [
          locked
              ? _lockedPanel(context, book, ch, ink)
              : ListView(
                  controller: _scroll,
                  padding: EdgeInsets.fromLTRB(_marginH, 8, _marginH, 120),
                  children: [
                    Center(child: Text(ch.title, textAlign: TextAlign.center, style: AppType.hero(size: 26, color: ink))),
                    const SizedBox(height: Gap.xl),
                    _body(ink),
                    const SizedBox(height: Gap.xl),
                    _endOfChapter(context, book, ink, chapters),
                  ],
                ),
          // Menu dưới auto-hide + thanh read-along (khi nghe).
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: AnimatedSlide(
              duration: const Duration(milliseconds: 220),
              offset: _chromeVisible ? Offset.zero : const Offset(0, 1),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                if (playingThis) _readAlongBar(context, app, book, bg, ink),
                _readerNav(context, bg, ink),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(Color ink) {
    if (_loadingContent) {
      return Padding(padding: const EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator(color: ink.withValues(alpha: 0.5))));
    }
    final base = _bodyStyle(ink);
    final paras = _content.split(RegExp(r'\n\s*\n')).map((p) => p.trim()).where((p) => p.isNotEmpty).toList();
    if (paras.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 48),
        child: Center(child: Text('Nội dung chương đang được cập nhật', style: base.copyWith(fontSize: 15))),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < paras.length; i++) ...[
          Text(paras[i], style: base),
          if (i < paras.length - 1) const SizedBox(height: Gap.lg),
        ],
      ],
    );
  }

  // Menu dưới 4 tab (thiết kế readding.png) — tap điều hướng về AppShell đúng tab.
  Widget _readerNav(BuildContext context, Color bg, Color ink) {
    final items = [
      (Icons.home_outlined, context.l10n.navHome, 0),
      (Icons.auto_awesome_outlined, context.l10n.navDiscover, 1),
      (Icons.north_east, context.l10n.navTrending, 2),
      (Icons.pie_chart_outline, context.l10n.navProfile, 3),
    ];
    return Container(
      decoration: BoxDecoration(color: bg, border: Border(top: BorderSide(color: ink.withValues(alpha: 0.12)))),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 60,
          child: Row(children: [
            for (final it in items)
              Expanded(
                child: InkWell(
                  onTap: () {
                    context.read<AppState>().setShellTab(it.$3);
                    context.go('/home');
                  },
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(it.$1, size: 21, color: ink.withValues(alpha: 0.75)),
                    const SizedBox(height: 3),
                    Text(it.$2, style: AppType.tabLabel(color: ink.withValues(alpha: 0.75))),
                  ]),
                ),
              ),
          ]),
        ),
      ),
    );
  }

  // Thanh read-along/audio (thiết kế nghe truyện.png).
  Widget _readAlongBar(BuildContext context, AppState app, Book book, Color bg, Color ink) {
    return Container(
      color: bg,
      padding: const EdgeInsets.fromLTRB(Gap.md, 8, Gap.sm, 8),
      child: Row(children: [
        ClipRRect(
          borderRadius: rounded(8),
          child: SizedBox(width: 40, height: 40, child: (book.cover.isNotEmpty) ? Image.asset(book.cover, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppPalette.plum)) : Container(color: AppPalette.plum)),
        ),
        const SizedBox(width: Gap.sm),
        Expanded(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Read-along · Ch. $_chapter · ${book.author}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 12.5, color: ink)),
            const SizedBox(height: 4),
            ValueListenableBuilder<Duration>(
              valueListenable: app.position,
              builder: (_, pos, __) {
                final durMs = app.duration.value.inMilliseconds;
                final v = durMs > 0 ? (pos.inMilliseconds / durMs).clamp(0.0, 1.0) : 0.0;
                return ClipRRect(
                  borderRadius: rounded(3),
                  child: LinearProgressIndicator(value: v.toDouble(), minHeight: 4, backgroundColor: ink.withValues(alpha: 0.15), color: AppPalette.terracotta),
                );
              },
            ),
          ]),
        ),
        const SizedBox(width: Gap.sm),
        GestureDetector(
          onTap: app.togglePlay,
          child: Container(
            width: 40, height: 40,
            decoration: const BoxDecoration(color: AppPalette.terracotta, shape: BoxShape.circle),
            child: Icon(app.playing ? Icons.pause : Icons.play_arrow, color: Colors.white, size: 22),
          ),
        ),
        IconButton(icon: Icon(Icons.close, color: ink.withValues(alpha: 0.7)), onPressed: app.stop),
      ]),
    );
  }

  Widget _lockedPanel(BuildContext context, Book book, Chapter ch, Color ink) {
    final isVip = ch.state == ChapterState.vip;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Gap.xxl),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.lock_outline, size: 54, color: ink.withValues(alpha: 0.5)),
          const SizedBox(height: Gap.lg),
          Text('Chapter ${ch.n} is locked', style: AppType.hero(size: 20, color: ink)),
          const SizedBox(height: 6),
          Text(isVip ? 'VIP chapter — subscribe or unlock with coins' : 'Unlock this chapter to keep reading',
              textAlign: TextAlign.center, style: AppType.body(size: 14, color: ink.withValues(alpha: 0.7))),
          const SizedBox(height: Gap.xl),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              style: TextButton.styleFrom(backgroundColor: AppPalette.terracotta, padding: const EdgeInsets.symmetric(vertical: 14)),
              onPressed: () async {
                final ok = await showUnlockSheet(context, book, ch);
                if (ok && mounted) {
                  setState(() {});
                  _loadContent();
                }
              },
              child: Text(isVip ? 'Unlock VIP chapter' : 'Unlock for ${ch.price} coins', style: AppType.btn(color: Colors.white)),
            ),
          ),
          if (isVip) ...[
            const SizedBox(height: Gap.sm),
            TextButton(onPressed: () => context.push('/subscription'), child: Text('See VIP plans', style: AppType.btn(size: 13, color: AppPalette.plum))),
          ],
        ]),
      ),
    );
  }

  // Cuối chương (thiết kế cuoi trang.png): divider + 3 thẻ + Previous / Next chapter.
  Widget _endOfChapter(BuildContext context, Book book, Color ink, List<Chapter> chapters) {
    final hasPrev = chapters.any((c) => c.n == _chapter - 1);
    final hasNext = chapters.any((c) => c.n == _chapter + 1);
    Widget card(IconData icon, String label, VoidCallback onTap) => Expanded(
          child: GestureDetector(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(borderRadius: rounded(14), border: Border.all(color: ink.withValues(alpha: 0.18))),
              child: Column(children: [
                Icon(icon, color: ink.withValues(alpha: 0.85), size: 22),
                const SizedBox(height: 6),
                Text(label, style: AppType.btn(size: 12.5, color: ink.withValues(alpha: 0.85))),
              ]),
            ),
          ),
        );
    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: Gap.md),
        child: Text('— End of Chapter $_chapter —', style: AppType.meta(size: 12, color: ink.withValues(alpha: 0.55))),
      ),
      Row(children: [
        card(Icons.mode_comment_outlined, 'Comment', () => showCommentSheet(context)),
        const SizedBox(width: Gap.md),
        card(Icons.favorite_border, 'Support', () => showGiftSheet(context, book.author)),
        const SizedBox(width: Gap.md),
        card(Icons.ios_share, 'Share', () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Share link to "${book.title}" copied')))),
      ]),
      const SizedBox(height: Gap.md),
      Row(children: [
        if (hasPrev)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            decoration: BoxDecoration(borderRadius: rounded(14), border: Border.all(color: ink.withValues(alpha: 0.3))),
            child: GestureDetector(onTap: () => _goChapter(_chapter - 1, chapters), child: Text('‹ Previous', style: AppType.btn(size: 14, color: ink))),
          ),
        if (hasPrev) const SizedBox(width: Gap.md),
        if (hasNext)
          Expanded(
            child: GestureDetector(
              onTap: () => _goChapter(_chapter + 1, chapters),
              child: Container(
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: AppPalette.terracotta, borderRadius: rounded(14)),
                child: Text('Next chapter  ›', style: AppType.btn(size: 15, color: Colors.white)),
              ),
            ),
          ),
      ]),
    ]);
  }

  void _openChapterList(List<Chapter> chapters) {
    final pal = context.pal;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: pal.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (c) => SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 10),
          Container(width: 38, height: 4, decoration: BoxDecoration(color: pal.line, borderRadius: rounded(2))),
          Builder(builder: (_) {
            final bms = _reader.bookmarks(widget.bookId);
            if (bms.isEmpty) return const SizedBox.shrink();
            return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.sm, Gap.xl, 4),
                child: Text('Bookmarks', style: AppType.section(color: pal.ink)),
              ),
              for (final b in bms)
                ListTile(
                  dense: true,
                  leading: Icon(Icons.bookmark, size: 18, color: AppPalette.terracotta),
                  title: Text('Ch ${b.chapter} · ${b.snippet}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.body(size: 13.5, color: pal.ink)),
                  trailing: IconButton(
                    icon: Icon(Icons.close, size: 16, color: pal.muted),
                    onPressed: () { _reader.removeBookmark(widget.bookId, b.savedAt); Navigator.pop(c); _openChapterList(chapters); },
                  ),
                  onTap: () {
                    _pendingJumpOffset = b.offset;
                    Navigator.pop(c);
                    _goChapter(b.chapter, chapters);
                  },
                ),
              const Divider(height: 12),
            ]);
          }),
          Padding(
            padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.md, Gap.xl, Gap.sm),
            child: Row(children: [Text('Chapters', style: AppType.section(color: pal.ink)), const Spacer(), Text('${chapters.length}', style: AppType.meta(color: pal.muted))]),
          ),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: chapters.length,
              itemBuilder: (_, i) {
                final c2 = chapters[i];
                final current = c2.n == _chapter;
                final locked = (c2.state == ChapterState.coin || c2.state == ChapterState.vip) && !context.read<AppState>().isUnlocked(widget.bookId, c2.n);
                return ListTile(
                  dense: true,
                  leading: SizedBox(width: 30, child: Text('${c2.n}', style: AppType.item(size: 13, color: current ? AppPalette.terracotta : pal.muted))),
                  title: Text(c2.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.body(size: 14, color: current ? AppPalette.terracotta : pal.ink)),
                  trailing: locked ? Icon(Icons.lock_outline, size: 16, color: pal.muted) : null,
                  onTap: () {
                    Navigator.pop(c);
                    _goChapter(c2.n, chapters);
                  },
                );
              },
            ),
          ),
        ]),
      ),
    );
  }

  // Reading settings chi tiết (thiết kế set trang.png).
  void _openSettings() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: context.pal.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (c) => StatefulBuilder(
        builder: (c, setSheet) {
          final pal = context.pal;
          void upd(VoidCallback fn) {
            setSheet(fn);
            setState(fn);
            _persistSettings();
          }

          Widget label(String t) => Padding(
                padding: const EdgeInsets.only(top: Gap.lg, bottom: Gap.sm),
                child: Text(t, style: AppType.meta(size: 11, color: pal.muted).copyWith(letterSpacing: 1)),
              );
          Widget pill(String text, bool sel, VoidCallback onTap, {double? w}) => GestureDetector(
                onTap: onTap,
                child: Container(
                  width: w,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: sel ? AppPalette.terracotta : pal.surf2,
                    borderRadius: rounded(12),
                    border: Border.all(color: sel ? AppPalette.terracotta : pal.line),
                  ),
                  child: Text(text, style: AppType.btn(size: 13.5, color: sel ? Colors.white : pal.ink)),
                ),
              );

          return DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.85,
            maxChildSize: 0.95,
            minChildSize: 0.5,
            builder: (c, controller) => SingleChildScrollView(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.md, Gap.xl, Gap.xxl),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Center(child: Container(width: 38, height: 4, decoration: BoxDecoration(color: pal.line, borderRadius: rounded(2)))),
                const SizedBox(height: Gap.md),
                Row(children: [
                  Text('Reading settings', style: AppType.section(color: pal.ink)),
                  const SizedBox(width: 6),
                  Text('Tùy chỉnh đọc', style: AppType.meta(size: 12, color: pal.muted)),
                  const Spacer(),
                  GestureDetector(onTap: () => Navigator.pop(c), child: Text('Done', style: AppType.btn(size: 14, color: AppPalette.terracotta))),
                ]),

                // BACKGROUND
                label('BACKGROUND'),
                Row(children: [
                  for (var i = 0; i < _bgs.length; i++)
                    Expanded(
                      child: GestureDetector(
                        onTap: () => upd(() => _bg = i),
                        child: Column(children: [
                          Container(
                            width: 31, height: 31,
                            decoration: BoxDecoration(
                              color: _bgs[i], shape: BoxShape.circle,
                              border: Border.all(color: _bg == i ? AppPalette.terracotta : pal.line, width: _bg == i ? 2 : 1),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(_bgLabels[i], style: AppType.meta(size: 10.5, color: pal.muted)),
                        ]),
                      ),
                    ),
                ]),

                // TEXT COLOR
                label('TEXT COLOR'),
                Wrap(spacing: 10, runSpacing: 10, children: [
                  for (final col in _palette)
                    if (col == null)
                      GestureDetector(
                        onTap: () => upd(() => _textColor = null),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            color: _textColor == null ? AppPalette.terracotta : pal.surf2,
                            borderRadius: rounded(20),
                            border: Border.all(color: _textColor == null ? AppPalette.terracotta : pal.line),
                          ),
                          child: Text('Auto', style: AppType.btn(size: 13, color: _textColor == null ? Colors.white : pal.ink)),
                        ),
                      )
                    else
                      GestureDetector(
                        onTap: () => upd(() => _textColor = col),
                        child: Container(
                          width: 28, height: 28,
                          decoration: BoxDecoration(
                            color: col, shape: BoxShape.circle,
                            border: Border.all(color: _textColor == col ? AppPalette.terracotta : pal.line, width: _textColor == col ? 2 : 1),
                          ),
                        ),
                      ),
                ]),

                // TEXT SIZE
                label('TEXT SIZE'),
                Row(children: [
                  Expanded(child: pill('A −', false, () => upd(() => _fontSize = (_fontSize - 1).clamp(14, 26)))),
                  SizedBox(width: 80, child: Center(child: Text('${_fontSize.round()} pt', style: AppType.item(size: 15, color: pal.ink)))),
                  Expanded(child: pill('A +', false, () => upd(() => _fontSize = (_fontSize + 1).clamp(14, 26)))),
                ]),

                // FONT
                label('FONT'),
                Row(children: [
                  Expanded(child: pill('Serif', _font == 'serif', () => upd(() => _font = 'serif'))),
                  const SizedBox(width: Gap.sm),
                  Expanded(child: pill('Sans', _font == 'sans', () => upd(() => _font = 'sans'))),
                  const SizedBox(width: Gap.sm),
                  Expanded(child: pill('Dyslexia', _font == 'dyslexia', () => upd(() => _font = 'dyslexia'))),
                ]),

                // LINE
                label('LINE'),
                Row(children: [
                  for (final h in const [1.4, 1.6, 1.8, 2.0]) ...[
                    Expanded(child: pill(h.toString(), _lineHeight == h, () => upd(() => _lineHeight = h))),
                    if (h != 2.0) const SizedBox(width: Gap.sm),
                  ],
                ]),

                // MARGIN
                label('MARGIN'),
                Row(children: [
                  Expanded(child: pill('Narrow', _margin == 'narrow', () => upd(() => _margin = 'narrow'))),
                  const SizedBox(width: Gap.sm),
                  Expanded(child: pill('Medium', _margin == 'medium', () => upd(() => _margin = 'medium'))),
                  const SizedBox(width: Gap.sm),
                  Expanded(child: pill('Wide', _margin == 'wide', () => upd(() => _margin = 'wide'))),
                ]),
              ]),
            ),
          );
        },
      ),
    );
  }
}
