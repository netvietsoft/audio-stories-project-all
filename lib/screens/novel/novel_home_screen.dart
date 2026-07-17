import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/reading_history/reading_history_store.dart';
import '../../data/repositories/banners_repository.dart';
import '../../data/repositories/categories_repository.dart';
import '../../data/repositories/history_repository.dart';
import '../../data/repositories/stories_repository.dart';
import '../../l10n/l10n_ext.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';
import '../../state/async_value.dart';
import '../../state/auth_notifier.dart';
import '../../state/stories_notifier.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';
import 'widgets/home_banner_carousel.dart';

class NovelHomeScreen extends StatefulWidget {
  const NovelHomeScreen({super.key});

  @override
  State<NovelHomeScreen> createState() => _NovelHomeScreenState();
}

class _NovelHomeScreenState extends State<NovelHomeScreen> {
  String _lastLang = '';

  // ── Hot Ranking theo kỳ (nhãn, trendWindow BE) ──
  static const _periods = <(String, String)>[
    ('Today', 'today'),
    ('Yesterday', 'yesterday'),
    ('This Week', 'week'),
    ('This Month', 'month'),
  ];
  late final StoriesRepository _repo;
  int _rankPeriod = 0;
  List<Book> _ranking = const [];
  bool _rankingLoading = true;

  // ── 3 khối data thật (độc lập với explore/StoriesNotifier) ──
  Book? _editorPick;                          // null → fallback value.first
  List<(Category, List<Book>)> _shelves = const []; // kệ < 3 truyện đã bị loại
  List<Book> _trending = const [];            // rỗng → ẩn section
  List<AppBanner> _banners = const [];        // rỗng/lỗi → ẩn carousel
  bool _historyPulled = false;                // pull-merge BE 1 lần mỗi phiên (khi đã login)

  @override
  void initState() {
    super.initState();
    _repo = context.read<StoriesRepository>();
    // KHÔNG load ở đây: _lastLang khởi tạo rỗng nên hook đổi-ngôn-ngữ trong build
    // LUÔN chạy ở frame đầu và đã gọi _loadRanking() + _loadHomeFeeds() —
    // gọi thêm ở initState là bắn đúp mọi request lúc mở app.
  }

  /// Bảng xếp hạng = truyện đọc nhiều nhất (sort=views) trong kỳ đang chọn,
  /// theo ngôn ngữ nội dung.
  Future<void> _loadRanking() async {
    if (mounted) setState(() => _rankingLoading = true);
    final lang = context.read<AppState>().contentLang;
    try {
      final paged = await _repo.explore(sort: 'views', trendWindow: _periods[_rankPeriod].$2, lang: lang, limit: 10);
      if (mounted) setState(() { _ranking = paged.books; _rankingLoading = false; });
    } catch (_) {
      if (mounted) setState(() { _ranking = const []; _rankingLoading = false; });
    }
  }

  /// Nạp 3 khối data thật của Home. Cache-first (hiện ngay bản cache nếu có)
  /// rồi fetch nền; mỗi khối lỗi riêng → fallback/ẩn riêng, không chặn Home.
  Future<void> _loadHomeFeeds() async {
    final lang = context.read<AppState>().contentLang;
    final cachedPick = _repo.cachedRecommended(lang);
    final cachedTrend = _repo.cachedTrending(lang);
    if (mounted && (cachedPick?.isNotEmpty == true || cachedTrend?.isNotEmpty == true)) {
      setState(() {
        if (cachedPick?.isNotEmpty == true) _editorPick = cachedPick!.first;
        if (cachedTrend?.isNotEmpty == true) _trending = cachedTrend!;
      });
    }
    await Future.wait([_loadEditorPick(lang), _loadShelves(lang), _loadTrending(lang), _loadBanners(lang), _pullHistory()]);
  }

  Future<void> _loadEditorPick(String lang) async {
    try {
      final books = await _repo.recommended(limit: 1, lang: lang);
      if (mounted && books.isNotEmpty) setState(() => _editorPick = books.first);
    } catch (_) {/* giữ null/cache → hero fallback value.first */}
  }

  Future<void> _loadTrending(String lang) async {
    try {
      final books = await _repo.trending(limit: 10, lang: lang);
      if (mounted) setState(() => _trending = books);
    } catch (_) {/* giữ cache/rỗng → ẩn section */}
  }

  Future<void> _loadShelves(String lang) async {
    try {
      final cats = await context.read<CategoriesRepository>().topCategories(limit: 3, lang: lang);
      final results = await Future.wait(cats.map((c) => _repo.explore(categoryId: c.id, limit: 9, lang: lang)));
      if (!mounted) return;
      setState(() {
        _shelves = [
          for (var i = 0; i < cats.length; i++)
            if (results[i].books.length >= 3) (cats[i], results[i].books),
        ];
      });
    } catch (_) {
      if (mounted) setState(() => _shelves = const []); // lỗi → ẩn kệ
    }
  }

  Future<void> _loadBanners(String lang) async {
    try {
      final list = await context.read<BannersRepository>().list(lang: lang);
      if (mounted) setState(() => _banners = list);
    } catch (_) {/* rỗng/lỗi → ẩn carousel */}
  }

  /// Pull lịch sử BE + merge vào store local — 1 lần mỗi phiên, chỉ khi đã login.
  Future<void> _pullHistory() async {
    if (_historyPulled) return;
    final auth = context.read<AuthNotifier>();
    if (auth.user == null) return;
    _historyPulled = true;
    try {
      final store = context.read<ReadingHistoryStore>();
      final remote = await context.read<HistoryRepository>().list();
      final merged = mergeHistory(store.entries(), remote);
      for (final e in merged) {
        await store.record(e);
      }
      // Máy mới/cài lại: hasLastRead vẫn false dù vừa merge xong history remote
      // (flag chỉ set khi mở chương TRÊN MÁY NÀY) → hydrate từ entry mới nhất
      // để Continue Reading + nút More hiện ngay, không cần đọc lại 1 chương.
      if (mounted && !context.read<AppState>().hasLastRead && merged.isNotEmpty) {
        final latest = merged.first; // merged đã sort desc theo savedAt
        context.read<AppState>().setLastRead(
              bookId: latest.bookId,
              title: latest.title,
              cover: latest.cover,
              chapter: latest.chapter,
              chapterTitle: '',
              total: latest.totalChapters,
            );
      }
      if (mounted) setState(() {}); // refresh nút More nếu vừa có history
    } catch (_) {/* offline/lỗi → thôi, local vẫn đủ */}
  }

  void _selectPeriod(int i) {
    if (_rankPeriod == i) return;
    setState(() => _rankPeriod = i);
    _loadRanking();
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    // Nạp/So lại theo ngôn ngữ nội dung (dùng chung StoriesNotifier với Discover).
    final contentLang = context.select<AppState, String>((a) => a.contentLang);
    if (contentLang != _lastLang) {
      _lastLang = contentLang;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        context.read<StoriesNotifier>().applyLang(contentLang);
        _loadRanking(); // xếp hạng cũng theo ngôn ngữ nội dung
        _loadHomeFeeds(); // 3 khối data thật cũng theo ngôn ngữ nội dung
      });
    }
    // Pull-merge history phản ứng theo login GIỮA phiên (cùng pattern hook lang
    // ở trên): logout → reset cờ để lần login sau pull lại; login khi đang đứng
    // ở Home → schedule pull sau frame (không gọi network trực tiếp trong build).
    final loggedIn = context.select<AuthNotifier, bool>((a) => a.user != null);
    if (!loggedIn) {
      _historyPulled = false;
    } else if (!_historyPulled) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _pullHistory();
      });
    }
    final notifier = context.watch<StoriesNotifier>();
    return Scaffold(
      backgroundColor: pal.bg,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppPalette.terracotta,
          onRefresh: () => Future.wait([
            context.read<StoriesNotifier>().loadExplore(forceRefresh: true),
            _loadHomeFeeds(),
            _loadRanking(),
          ]),
          child: ListView(
            padding: EdgeInsets.zero,
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const TopBarShared(),
              _readingHeader(context),
              ..._content(context, notifier),
              const SizedBox(height: Gap.xxl),
            ],
          ),
        ),
      ),
    );
  }

  // Render khu vực truyện theo trạng thái async (TopBarShared luôn hiển thị).
  List<Widget> _content(BuildContext context, StoriesNotifier n) {
    final app = context.watch<AppState>();
    return switch (n.explore) {
      AsyncLoading() => [const SizedBox(height: Gap.lg), _railSkeleton(context), _railSkeleton(context)],
      AsyncError(:final error) => [_errorView(context, error)],
      AsyncData(:final value) when value.isEmpty => [_emptyView(context)],
      AsyncData(:final value) => [
          if (_banners.isNotEmpty) HomeBannerCarousel(banners: _banners),
          _editorHero(context, _editorPick ?? value.first),
          // Continue Reading: chỉ hiện khi có lịch sử đọc THẬT (không còn demo).
          if (app.hasLastRead) ...[
            _sectionHeader(
              context, 'Continue Reading',
              onMore: context.read<ReadingHistoryStore>().entries().isNotEmpty
                  ? () => context.push('/reading-history')
                  : null,
              moreLabel: 'More...',
            ),
            _continueReading(context, app),
          ],
          _sectionHeader(context, 'For You', onMore: () => context.push('/for-you')),
          _bookRail(context, value),
          _hotRankingHeader(context),
          ..._rankingSection(context),
          // ── Kệ theo thể loại nhiều truyện nhất (data thật /stories/categories/top) ──
          for (final s in _shelves) ...[
            _sectionHeader(context, s.$1.name,
                onMore: () => context.push('/category/${s.$1.id}?name=${Uri.encodeComponent(s.$1.name)}'),
                moreLabel: 'More'),
            _collectionRail(context, s.$2),
          ],
          // ── New & Trending (data thật /stories/trending, window week) — rỗng thì ẩn ──
          if (_trending.isNotEmpty) ...[
            _sectionHeader(context, 'New & Trending'),
            _bookRail(context, _trending),
          ],
        ],
    };
  }

  /// Header trang: "Reading" + phụ đề (theo thiết kế home.png).
  Widget _readingHeader(BuildContext context) {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.lg, Gap.screenH, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Reading', style: AppType.hero(size: 30, color: pal.ink)),
        const SizedBox(height: 2),
        Text('Novel, short drama stories', style: AppType.body(size: 14, color: pal.muted)),
      ]),
    );
  }

  /// Hero "Editor's Pick" — thẻ maroon lớn + bìa + Read Now (thiết kế home.png).
  Widget _editorHero(BuildContext context, Book b) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.lg, Gap.screenH, 0),
      child: GestureDetector(
        onTap: () => context.push('/book/${b.id}'),
        child: Container(
          padding: const EdgeInsets.all(Gap.lg),
          decoration: BoxDecoration(
            borderRadius: rounded(18),
            gradient: const LinearGradient(
              colors: [Color(0xFF4A1E33), Color(0xFF7A3B55)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("EDITOR'S PICK · ${b.genre.toUpperCase()}",
                        style: AppType.tabLabel(color: AppPalette.coinA)),
                    const SizedBox(height: 6),
                    Text(b.title, style: AppType.hero(size: 24, color: Colors.white)),
                    const SizedBox(height: 8),
                    Text('⭐ ${b.rating} · ${b.reads} reads · ${b.chapters} chapters',
                        style: AppType.meta(size: 12, color: Colors.white70)),
                    const SizedBox(height: Gap.md),
                    GestureDetector(
                      onTap: () => context.push('/reader/${b.id}'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                        decoration: BoxDecoration(color: const Color(0xFFFBF3E3), borderRadius: rounded(24)),
                        child: Text('Read Now  →', style: AppType.btn(size: 14, color: const Color(0xFF7A3B55))),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: Gap.md),
              SizedBox(width: 96, child: CoverImage(path: b.cover, title: b.title, radius: 10)),
            ],
          ),
        ),
      ),
    );
  }

  /// Header "Hot Ranking" + bộ chọn kỳ (Today/Yesterday/This Week/This Month).
  Widget _hotRankingHeader(BuildContext context) {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.xl, Gap.screenH, Gap.sm),
      child: Row(children: [
        Expanded(child: Text('Hot Ranking', style: AppType.section(color: pal.ink))),
        GestureDetector(
          onTap: _pickPeriod,
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(_periods[_rankPeriod].$1, style: AppType.btn(size: 13, color: AppPalette.terracotta)),
            const Icon(Icons.keyboard_arrow_down, size: 18, color: AppPalette.terracotta),
          ]),
        ),
      ]),
    );
  }

  /// Sheet chọn kỳ xếp hạng.
  void _pickPeriod() {
    final pal = context.pal;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: pal.bg2,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < _periods.length; i++)
            ListTile(
              title: Text(_periods[i].$1, style: AppType.item(size: 15, color: i == _rankPeriod ? AppPalette.terracotta : pal.ink)),
              trailing: i == _rankPeriod ? const Icon(Icons.check, color: AppPalette.terracotta) : null,
              onTap: () {
                Navigator.of(context).pop();
                _selectPeriod(i);
              },
            ),
        ]),
      ),
    );
  }

  /// Nội dung bảng xếp hạng: podium top 3 + list hạng 4–7 (từ [_ranking]).
  List<Widget> _rankingSection(BuildContext context) {
    final pal = context.pal;
    if (_rankingLoading) {
      return [const Padding(padding: EdgeInsets.symmetric(vertical: 28), child: Center(child: CircularProgressIndicator(color: AppPalette.terracotta)))];
    }
    if (_ranking.isEmpty) {
      return [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 28, horizontal: Gap.screenH),
          child: Center(child: Text('Chưa có bảng xếp hạng cho kỳ này', style: AppType.body(size: 13.5, color: pal.muted))),
        ),
      ];
    }
    final r = _ranking;
    return [
      if (r.length >= 3) _top3Podium(context, r.take(3).toList()),
      ...r.skip(3).take(4).toList().asMap().entries.map((e) => _rankRow(context, e.key + 4, e.value)),
    ];
  }

  Widget _railSkeleton(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.md, Gap.screenH, 0),
        child: SizedBox(
          height: 200,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: 4,
            separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
            itemBuilder: (_, __) => SizedBox(
              width: 116,
              child: AspectRatio(
                aspectRatio: 3 / 4,
                child: Container(decoration: BoxDecoration(color: context.pal.surf, borderRadius: rounded(Radii.cover))),
              ),
            ),
          ),
        ),
      );

  Widget _emptyView(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Center(child: Text('Chưa có truyện', style: AppType.body(size: 14, color: context.pal.muted))),
      );

  Widget _errorView(BuildContext context, Object error) {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(children: [
        Icon(Icons.cloud_off, size: 44, color: pal.muted),
        const SizedBox(height: 10),
        Text('Không tải được truyện', style: AppType.item(size: 14, color: pal.ink)),
        const SizedBox(height: 4),
        Text('$error', textAlign: TextAlign.center, style: AppType.meta(size: 11, color: pal.muted)),
        const SizedBox(height: Gap.md),
        TextButton(
          style: TextButton.styleFrom(backgroundColor: AppPalette.terracotta, padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11)),
          onPressed: () => context.read<StoriesNotifier>().loadExplore(),
          child: Text('Thử lại', style: AppType.btn(size: 13, color: Colors.white)),
        ),
      ]),
    );
  }

  Widget _continueReading(BuildContext context, AppState app) {
    final pal = context.pal;
    final total = app.lastReadTotal;
    final ch = app.lastReadChapter;
    final progress = total > 0 ? (ch / total).clamp(0.0, 1.0) : 0.0;
    final title = app.lastReadTitle ?? '';
    final chapterLine = app.lastReadChapterTitle?.isNotEmpty == true
        ? 'Chapter $ch · ${app.lastReadChapterTitle}'
        : 'Chapter $ch';
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.sm, Gap.screenH, 0),
      child: GestureDetector(
        onTap: () => context.push('/reader/${app.lastReadBookId}?ch=$ch'),
        child: Container(
          padding: const EdgeInsets.all(Gap.md),
          decoration: BoxDecoration(
            color: pal.card,
            borderRadius: rounded(Radii.card),
            border: Border.all(color: pal.line),
          ),
          child: Row(
            children: [
              SizedBox(width: 56, child: CoverImage(path: app.lastReadCover ?? '', title: title)),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 14.5, color: pal.ink)),
                    const SizedBox(height: 3),
                    Text(chapterLine, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 12, color: pal.muted)),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: rounded(4),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 6,
                        backgroundColor: pal.line,
                        color: AppPalette.terracotta,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text('${(progress * 100).round()}% · $ch / $total chapters', style: AppType.meta(size: 11, color: pal.muted)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionHeader(BuildContext context, String title, {VoidCallback? onMore, String moreLabel = 'View All'}) {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.xl, Gap.screenH, Gap.sm),
      child: Row(
        children: [
          Expanded(child: Text(title, style: AppType.section(color: pal.ink))),
          if (onMore != null)
            GestureDetector(
              onTap: onMore,
              child: Text(moreLabel, style: AppType.btn(size: 13, color: AppPalette.terracotta)),
            ),
        ],
      ),
    );
  }

  /// Kệ bộ sưu tập theo chủ đề — 3 cột bìa lớn (thiết kế anh/home/2.png).
  Widget _collectionRail(BuildContext context, List<Book> books) {
    final w = MediaQuery.sizeOf(context).width;
    const gap = 12.0;
    final cardW = (w - Gap.screenH * 2 - gap * 2) / 3;
    return SizedBox(
      height: cardW * 4 / 3 + 46, // bìa 3:4 + tên + dòng ⭐·view
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenH),
        itemCount: books.length,
        separatorBuilder: (_, __) => const SizedBox(width: gap),
        itemBuilder: (_, i) => _collectionCard(context, books[i], cardW),
      ),
    );
  }

  Widget _collectionCard(BuildContext context, Book b, double width) {
    final pal = context.pal;
    return GestureDetector(
      onTap: () => context.push('/book/${b.id}'),
      child: SizedBox(
        width: width,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(children: [
              CoverImage(path: b.cover, title: b.title, radius: Radii.cover),
              if (b.label != null) Positioned(left: 6, top: 6, child: _badge(b.label!)),
            ]),
            const SizedBox(height: 6),
            Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 13, color: pal.soft)),
            const SizedBox(height: 2),
            Text('⭐ ${b.rating} · ${b.reads}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 11, color: pal.muted)),
          ],
        ),
      ),
    );
  }

  /// Badge góc bìa (nền theo màu label; fallback tối mờ) — thống nhất cho mọi rail.
  Widget _badge(StoryLabel label) {
    Color bg = Colors.black.withValues(alpha: 0.55);
    final hex = label.color.replaceFirst('#', '');
    if (hex.length == 6) {
      final v = int.tryParse('FF$hex', radix: 16);
      if (v != null) bg = Color(v);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: rounded(6)),
      child: Text(label.text, style: AppType.tabLabel(color: Colors.white).copyWith(fontSize: 9.5)),
    );
  }

  // Khoảng cách giữa 2 bìa trong rail (nhỏ hơn để vừa 4 cột).
  static const double _railGap = 10;

  Widget _bookRail(BuildContext context, List<Book> books) {
    // Tính bề rộng bìa để hiện đúng 4 cột vừa khít màn hình.
    final w = MediaQuery.sizeOf(context).width;
    final cardW = (w - Gap.screenH * 2 - _railGap * 3) / 4;
    return SizedBox(
      height: cardW * 4 / 3 + 42, // bìa 3:4 + tên + dòng ⭐·thể loại
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenH),
        itemCount: books.length,
        separatorBuilder: (_, __) => const SizedBox(width: _railGap),
        itemBuilder: (_, i) => _bookCard(context, books[i], cardW),
      ),
    );
  }

  Widget _bookCard(BuildContext context, Book b, double width) {
    final pal = context.pal;
    return GestureDetector(
      onTap: () => context.push('/book/${b.id}'),
      child: SizedBox(
        width: width,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                CoverImage(path: b.cover, title: b.title, radius: Radii.cover),
                if (b.label != null) Positioned(left: 5, top: 5, child: _badge(b.label!)),
              ],
            ),
            const SizedBox(height: 5),
            Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 11.5, color: pal.soft)),
            Text('⭐ ${b.rating}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 10, color: pal.muted)),
          ],
        ),
      ),
    );
  }

  /// Top 3 dạng bục (thiết kế anh/Foru/hot ranking.png): hạng 1 to ở GIỮA cao hơn,
  /// hạng 2 trái, hạng 3 phải. CHÂN ẢNH bằng nhau (hàng bìa canh đáy), tên/thể loại
  /// ở hàng riêng bên dưới nên thẳng cột; chữ dài → "…".
  Widget _top3Podium(BuildContext context, List<Book> top) {
    // Thứ tự hiển thị trái→phải: hạng 2, hạng 1 (giữa), hạng 3.
    final items = <(Book, int)>[(top[1], 2), (top[0], 1), (top[2], 3)];
    const flex = [10, 13, 10];
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.sm, Gap.screenH, Gap.md),
      child: Column(children: [
        // Hàng bìa — canh ĐÁY để chân ảnh bằng nhau (hạng 1 to sẽ nhô lên trên).
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (var i = 0; i < 3; i++) ...[
              if (i > 0) const SizedBox(width: 10),
              Expanded(flex: flex[i], child: _podiumCover(context, items[i].$1, items[i].$2)),
            ],
          ],
        ),
        const SizedBox(height: 6),
        // Hàng chữ — cùng flex nên thẳng cột với bìa; tên 2 dòng, tràn → "…".
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < 3; i++) ...[
              if (i > 0) const SizedBox(width: 10),
              Expanded(flex: flex[i], child: _podiumText(context, items[i].$1, items[i].$2)),
            ],
          ],
        ),
      ]),
    );
  }

  Widget _podiumCover(BuildContext context, Book b, int rank) {
    return GestureDetector(
      onTap: () => context.push('/book/${b.id}'),
      child: Stack(children: [
        CoverImage(path: b.cover, title: b.title, radius: 12),
        Positioned(left: 0, top: 0, child: _rankBadge(rank, corner: 12)),
      ]),
    );
  }

  /// Badge số hạng đặt trên bìa: #1 vàng · #2 đỏ mận · #3 xanh · còn lại tối mờ.
  Widget _rankBadge(int rank, {double corner = 8}) {
    final color = rank == 1
        ? const Color(0xFFE0A82E)
        : rank == 2
            ? const Color(0xFF8B2E3C)
            : rank == 3
                ? const Color(0xFF2E5D8B)
                : Colors.black.withValues(alpha: 0.6);
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.only(topLeft: Radius.circular(corner), bottomRight: Radius.circular(10)),
      ),
      alignment: Alignment.center,
      child: Text('$rank', style: AppType.hero(size: 13, color: Colors.white)),
    );
  }

  Widget _podiumText(BuildContext context, Book b, int rank) {
    final pal = context.pal;
    return GestureDetector(
      onTap: () => context.push('/book/${b.id}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: rank == 1 ? 14 : 13, color: pal.ink)),
        const SizedBox(height: 2),
        Text(b.genre, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 11.5, color: pal.amber)),
      ]),
    );
  }

  Widget _rankRow(BuildContext context, int rank, Book b) {
    final pal = context.pal;
    return GestureDetector(
      onTap: () => context.push('/book/${b.id}'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 8, Gap.screenH, 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(
              width: 48,
              child: Stack(children: [
                CoverImage(path: b.cover, title: b.title, radius: 8),
                Positioned(left: 0, top: 0, child: _rankBadge(rank)),
              ]),
            ),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 15, color: pal.ink)),
                  const SizedBox(height: 4),
                  // Dòng 2: thể loại · thể loại phụ
                  Text(_subgenre(b), maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 12.5, color: pal.muted)),
                  const SizedBox(height: 3),
                  // Dòng 3: ⭐ số sao · số view đọc · trạng thái ra truyện
                  Text('⭐ ${b.rating} · ${b.reads} reads · ${_statusLabel(b.status)}',
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 12.5, color: pal.muted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// "Genre · Subgenre" (bỏ phần rỗng); rỗng cả hai → nhãn mặc định.
  String _subgenre(Book b) {
    final parts = [b.genre, b.trope].where((s) => s.isNotEmpty).toList();
    return parts.isEmpty ? 'Novel' : parts.join(' · ');
  }

  /// Nhãn trạng thái ra truyện: Completed / Ongoing.
  String _statusLabel(String status) {
    final s = status.toLowerCase();
    final completed = s.startsWith('complet') || s.contains('hoàn') || s == 'full' || s == 'done';
    return completed ? 'Completed' : 'Ongoing';
  }
}

/// Thanh đầu Home: menu Novel/Audio + coin pill + nút theme. Dùng chung cho
/// Novel Home và Audio Home.
class TopBarShared extends StatelessWidget {
  const TopBarShared({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.sm, Gap.screenH, 0),
      child: Row(
        children: [
          _modeTab(context, context.l10n.modeNovel, AppMode.novel, app),
          const SizedBox(width: Gap.lg),
          _modeTab(context, context.l10n.modeAudio, AppMode.audio, app),
          const Spacer(),
          _coinPill(context, app.coins),
          const SizedBox(width: Gap.sm),
          // Quà tặng → ví/thưởng; Globe → ngôn ngữ (theo thiết kế home.png).
          _circleBtn(context, Icons.card_giftcard_outlined, () => context.push('/wallet')),
          const SizedBox(width: Gap.sm),
          _circleBtn(context, Icons.language, () => context.push('/language')),
        ],
      ),
    );
  }

  Widget _circleBtn(BuildContext context, IconData icon, VoidCallback onTap) {
    final pal = context.pal;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(color: pal.card, shape: BoxShape.circle, border: Border.all(color: pal.line)),
        alignment: Alignment.center,
        child: Icon(icon, size: 19, color: pal.soft),
      ),
    );
  }

  Widget _modeTab(BuildContext context, String label, AppMode m, AppState app) {
    final active = app.mode == m;
    // Tab đang chọn: ĐẬM + màu accent theo chế độ (giống nhãn "Home" active ở
    // bottom nav — Novel=terracotta, Audio=plum).
    final accent = m == AppMode.novel ? AppPalette.terracotta : AppPalette.plum;
    return GestureDetector(
      onTap: () => app.setMode(m),
      child: Text(
        label,
        style: AppType.hero(size: 22, color: active ? accent : context.pal.muted)
            .copyWith(fontWeight: active ? FontWeight.w800 : FontWeight.w600),
      ),
    );
  }

  Widget _coinPill(BuildContext context, int coins) {
    final pal = context.pal;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(color: pal.card, borderRadius: rounded(20), border: Border.all(color: pal.line)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 15,
            height: 15,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(colors: [AppPalette.coinA, AppPalette.coinB]),
            ),
          ),
          const SizedBox(width: 5),
          Text('$coins', style: AppType.item(size: 13, color: pal.amber)),
          Text(' +', style: AppType.btn(size: 14, color: pal.amber)),
        ],
      ),
    );
  }
}
