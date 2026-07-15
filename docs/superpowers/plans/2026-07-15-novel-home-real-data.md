# Novel Home — Data thật Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novel Home dùng data thật: Editor's Pick từ `/stories/recommended`, 3 kệ từ `/stories/categories/top` + explore theo category, New & Trending từ `/stories/trending`; thêm màn `/category/:id` (đích nút More); bỏ mọi logic giả (xoay vòng, list đảo).

**Architecture:** Thêm 3 method repository (`recommended`/`trending` ở StoriesRepository + `topCategories` ở CategoriesRepository, đều kèm cache JsonCache và bản đọc cache đồng bộ). Home giữ state riêng từng khối (pattern `_ranking` sẵn có), load song song, cache-first rồi fetch nền; mỗi khối lỗi thì fallback/ẩn riêng. Màn mới `CategoryStoriesScreen` list dọc + infinite scroll qua `explore(categoryId, page)`.

**Tech Stack:** Flutter, provider, go_router, dio (đã có). KHÔNG dep mới.

**Spec:** `docs/superpowers/specs/2026-07-15-novel-home-real-data-design.md`

## Global Constraints

- KHÔNG dep mới; KHÔNG đụng BE.
- KHÔNG đụng: Hot Ranking, Continue Reading, For You (rail + notifier), TopBarShared, Discover/Trending tab, layout/thứ tự section (chốt Khối 4 — giữ nguyên), nhãn tiếng Anh giữ nguyên.
- Endpoint chính xác: `GET /stories/recommended?limit=&lang=` · `GET /stories/categories/top?limit=&lang=` · `GET /stories/trending?limit=&lang=&trendWindow=week` (const `storiesTrending` ĐÃ có sẵn trong api_endpoints.dart) · `GET /stories/explore?categoryId=&page=&limit=&lang=` (method `explore` đã có).
- Kệ < 3 truyện → loại; New & Trending rỗng/lỗi → ẩn cả section (header lẫn rail); Editor's Pick lỗi/rỗng → fallback `value.first`.
- Cache keys: `cache.home.recommended.<lang>`, `cache.home.topcats.<lang>`, `cache.home.trending.<lang>`.
- Flutter KHÔNG trong PATH → `"/d/SetupC/flutter/bin/flutter.bat"` (bash).
- Git repo `D:\SetupC\Projects\NovelApp\novelverse` (master); commit mỗi task, kết body: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Endpoints + repo methods (recommended / trending / topCategories)

**Files:**
- Modify: `lib/api/api_endpoints.dart:20-29` (thêm 2 const — `storiesTrending` đã có)
- Modify: `lib/data/repositories/stories_repository.dart` (sau `cachedExplore`, ~dòng 140)
- Modify: `lib/data/repositories/categories_repository.dart` (thêm 2 method cuối class)
- Test: `test/data/home_feeds_test.dart` (tạo mới)

**Interfaces:**
- Produces: `StoriesRepository.recommended({int limit = 1, String lang = 'en'}) → Future<List<Book>>`; `StoriesRepository.cachedRecommended(String lang) → List<Book>?`; `StoriesRepository.trending({int limit = 10, String lang = 'en', String window = 'week'}) → Future<List<Book>>`; `StoriesRepository.cachedTrending(String lang) → List<Book>?`; `CategoriesRepository.topCategories({int limit = 3, String lang = 'vi'}) → Future<List<Category>>`. Task 3 gọi đúng các tên này.

- [ ] **Step 1: Viết test thất bại** — tạo `test/data/home_feeds_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/repositories/categories_repository.dart';
import 'package:novelverse/data/repositories/stories_repository.dart';

/// ApiClient giả: trả response cố định, ghi lại path+query để assert.
class _FakeApi extends ApiClient {
  _FakeApi(this.response);
  final dynamic response;
  String? lastPath;
  Map<String, dynamic>? lastQuery;
  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query, bool raw = false}) async {
    lastPath = path;
    lastQuery = query;
    return response;
  }
}

const _story = {'id': 's1', 'slug': 's1', 'title': 'T', 'thumbnailUrl': ''};

void main() {
  test('recommended() gọi /stories/recommended + map Book', () async {
    final api = _FakeApi([_story]);
    final repo = StoriesRepository(api);
    final books = await repo.recommended(limit: 1, lang: 'vi');
    expect(api.lastPath, '/stories/recommended');
    expect(api.lastQuery?['limit'], 1);
    expect(api.lastQuery?['lang'], 'vi');
    expect(books, hasLength(1));
    expect(books.first.title, 'T');
  });

  test('trending() gọi /stories/trending với trendWindow=week (mặc định) + chịu được envelope', () async {
    final api = _FakeApi({'data': [_story], 'meta': {'total': 1}});
    final repo = StoriesRepository(api);
    final books = await repo.trending(lang: 'vi');
    expect(api.lastPath, '/stories/trending');
    expect(api.lastQuery?['limit'], 10);
    expect(api.lastQuery?['trendWindow'], 'week');
    expect(books, hasLength(1));
  });

  test('topCategories() gọi /stories/categories/top + map Category', () async {
    final api = _FakeApi([
      {'id': 3, 'name': 'Ngôn tình', 'slug': 'ngon-tinh'},
      {'id': 7, 'name': 'Kiếm hiệp', 'slug': 'kiem-hiep'},
    ]);
    final repo = CategoriesRepository(api);
    final cats = await repo.topCategories(limit: 3, lang: 'vi');
    expect(api.lastPath, '/stories/categories/top');
    expect(api.lastQuery?['limit'], 3);
    expect(cats, hasLength(2));
    expect(cats.first.id, 3);
    expect(cats.first.name, 'Ngôn tình');
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/home_feeds_test.dart`
Expected: FAIL compile — `recommended`/`trending`/`topCategories` undefined.

- [ ] **Step 3a: Thêm endpoint const** — `lib/api/api_endpoints.dart`, trong nhóm `── Stories / Chapters ──`, ngay DƯỚI dòng `static const storiesCategories = '/stories/categories';`:

```dart
  static const storiesCategoriesTop = '/stories/categories/top';
  static const storiesRecommended = '/stories/recommended';
```

(`storiesTrending = '/stories/trending'` đã tồn tại — KHÔNG thêm lại.)

- [ ] **Step 3b: Thêm 3 method + helper vào `StoriesRepository`** — trong `lib/data/repositories/stories_repository.dart`, ngay SAU method `cachedExplore` (sau dấu `}` của nó):

```dart
  static String _recommendedKey(String lang) => 'cache.home.recommended.$lang';
  static String _trendingKey(String lang) => 'cache.home.trending.$lang';

  /// `GET /stories/recommended` — truyện admin đề cử (Editor's Pick).
  Future<List<Book>> recommended({int limit = 1, String lang = 'en'}) async {
    final data = await _api.get(ApiEndpoints.storiesRecommended, query: {
      'limit': limit,
      if (lang.isNotEmpty) 'lang': lang,
    });
    final list = unwrapList(data);
    _cache?.writeList(_recommendedKey(lang), list);
    return _mapBooks(list);
  }

  /// Bản cache local của [recommended] (đồng bộ). Null nếu chưa có.
  List<Book>? cachedRecommended(String lang) => _cachedBooks(_recommendedKey(lang));

  /// `GET /stories/trending` — truyện đọc nhiều theo kỳ (BE mặc định week).
  Future<List<Book>> trending({int limit = 10, String lang = 'en', String window = 'week'}) async {
    final data = await _api.get(ApiEndpoints.storiesTrending, query: {
      'limit': limit,
      'trendWindow': window,
      if (lang.isNotEmpty) 'lang': lang,
    });
    final list = unwrapList(data);
    _cache?.writeList(_trendingKey(lang), list);
    return _mapBooks(list);
  }

  /// Bản cache local của [trending] (đồng bộ). Null nếu chưa có.
  List<Book>? cachedTrending(String lang) => _cachedBooks(_trendingKey(lang));

  List<Book> _mapBooks(List<dynamic> list) => list
      .whereType<Map>()
      .map((j) => BookMapper.fromJson(Map<String, dynamic>.from(j)))
      .toList();

  List<Book>? _cachedBooks(String key) {
    final c = _cache?.readList(key);
    if (c == null) return null;
    return _mapBooks(c.data);
  }
```

- [ ] **Step 3c: Thêm 2 method vào `CategoriesRepository`** — `lib/data/repositories/categories_repository.dart`, trước dấu `}` đóng class:

```dart
  /// `GET /stories/categories/top` — thể loại nhiều truyện nhất (BE cache 1h).
  /// Dùng làm tiêu đề 3 kệ chủ đề ở Novel Home.
  Future<List<Category>> topCategories({int limit = 3, String lang = 'vi'}) async {
    final data = await _api.get(ApiEndpoints.storiesCategoriesTop, query: {'limit': limit, 'lang': lang});
    final list = unwrapList(data);
    _cache?.writeList('cache.home.topcats.$lang', list);
    return list
        .whereType<Map>()
        .map((j) => CategoryMapper.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }

  /// Bản cache local của [topCategories] (đồng bộ). Null nếu chưa có.
  List<Category>? cachedTopCategories({String lang = 'vi'}) {
    final c = _cache?.readList('cache.home.topcats.$lang');
    if (c == null) return null;
    return c.data
        .whereType<Map>()
        .map((j) => CategoryMapper.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }
```

- [ ] **Step 4: Chạy test → PASS (cả test/data cũ)**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/`
Expected: PASS toàn bộ (3 test mới + các test cũ không vỡ).

- [ ] **Step 5: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/api/api_endpoints.dart lib/data/repositories/stories_repository.dart lib/data/repositories/categories_repository.dart test/data/home_feeds_test.dart
git commit -m "feat(data): repo recommended/trending/topCategories (+cache) cho Novel Home

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Màn `/category/:id` — CategoryStoriesScreen

**Files:**
- Create: `lib/screens/novel/category_stories_screen.dart`
- Modify: `lib/router.dart` (thêm import + 1 route sau `/for-you`)

**Interfaces:**
- Consumes: `StoriesRepository.explore({categoryId, page, limit, lang}) → Future<PagedBooks>` (đã có; `PagedBooks.hasMore`), `AppState.contentLang`, `CoverImage`, theme tokens.
- Produces: route `/category/:id?name=` — Task 3 push tới đây từ nút More.

- [ ] **Step 1: Tạo `lib/screens/novel/category_stories_screen.dart`:**

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/repositories/stories_repository.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

/// Danh sách truyện theo THỂ LOẠI (đích nút "More" trên kệ Novel Home).
/// List dọc + infinite scroll qua explore(categoryId, page).
class CategoryStoriesScreen extends StatefulWidget {
  const CategoryStoriesScreen({super.key, required this.categoryId, required this.name});
  final int categoryId;
  final String name;

  @override
  State<CategoryStoriesScreen> createState() => _CategoryStoriesScreenState();
}

class _CategoryStoriesScreenState extends State<CategoryStoriesScreen> {
  final _scroll = ScrollController();
  final List<Book> _books = [];
  int _page = 1;
  bool _hasMore = true, _loading = false, _error = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients || _loading || !_hasMore) return;
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 400) _load();
  }

  Future<void> _load() async {
    if (_loading || !_hasMore) return;
    setState(() { _loading = true; _error = false; });
    try {
      final lang = context.read<AppState>().contentLang;
      final paged = await context
          .read<StoriesRepository>()
          .explore(categoryId: widget.categoryId, page: _page, limit: 20, lang: lang);
      if (!mounted) return;
      setState(() {
        _books.addAll(paged.books);
        _hasMore = paged.hasMore;
        _page += 1;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _error = true; });
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
        iconTheme: IconThemeData(color: pal.ink),
        title: Text(widget.name, style: AppType.section(color: pal.ink)),
      ),
      body: _books.isEmpty && _loading
          ? const Center(child: CircularProgressIndicator(color: AppPalette.terracotta))
          : _books.isEmpty && _error
              ? _errorView()
              : _books.isEmpty
                  ? Center(child: Text('Chưa có truyện', style: AppType.body(size: 14, color: pal.muted)))
                  : ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.symmetric(vertical: Gap.md),
                      itemCount: _books.length + (_hasMore ? 1 : 0),
                      itemBuilder: (_, i) {
                        if (i >= _books.length) {
                          return const Padding(
                            padding: EdgeInsets.symmetric(vertical: 18),
                            child: Center(child: CircularProgressIndicator(color: AppPalette.terracotta)),
                          );
                        }
                        return _row(_books[i]);
                      },
                    ),
    );
  }

  Widget _row(Book b) {
    final pal = context.pal;
    return GestureDetector(
      onTap: () => context.push('/book/${b.id}'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 8, Gap.screenH, 8),
        child: Row(children: [
          SizedBox(width: 48, child: CoverImage(path: b.cover, title: b.title, radius: 8)),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 15, color: pal.ink)),
              const SizedBox(height: 4),
              Text('⭐ ${b.rating} · ${b.reads} reads',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 12.5, color: pal.muted)),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _errorView() {
    final pal = context.pal;
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.cloud_off, size: 44, color: pal.muted),
        const SizedBox(height: 10),
        Text('Không tải được truyện', style: AppType.item(size: 14, color: pal.ink)),
        const SizedBox(height: Gap.md),
        TextButton(
          style: TextButton.styleFrom(
              backgroundColor: AppPalette.terracotta,
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11)),
          onPressed: _load,
          child: Text('Thử lại', style: AppType.btn(size: 13, color: Colors.white)),
        ),
      ]),
    );
  }
}
```

- [ ] **Step 2: Thêm route** — `lib/router.dart`:

2a. Import (theo thứ tự alphabet trong nhóm `screens/novel/`, sau `book_detail_screen.dart`):

```dart
import 'screens/novel/category_stories_screen.dart';
```

2b. Route — ngay SAU dòng `GoRoute(path: '/for-you', ...)`:

```dart
    GoRoute(
      path: '/category/:id',
      builder: (_, s) => CategoryStoriesScreen(
        categoryId: int.tryParse(s.pathParameters['id'] ?? '') ?? 0,
        name: s.uri.queryParameters['name'] ?? 'Category',
      ),
    ),
```

- [ ] **Step 3: Verify compile + suite**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze` → 0 lỗi/0 cảnh báo (info có sẵn OK).
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → PASS toàn bộ.

- [ ] **Step 4: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/screens/novel/category_stories_screen.dart lib/router.dart
git commit -m "feat(novel): màn /category/:id — danh sách truyện theo thể loại, infinite scroll

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Novel Home — wiring 3 khối data thật

**Files:**
- Modify: `lib/screens/novel/novel_home_screen.dart` (import, state, initState, lang-hook, `_content`, `_editorHero`, XOÁ `_collections`, RefreshIndicator)

**Interfaces:**
- Consumes (Task 1): `recommended`/`cachedRecommended`/`trending`/`cachedTrending` (StoriesRepository), `topCategories` (CategoriesRepository); (Task 2): route `/category/:id?name=`.
- Produces: không — task cuối cùng có code.

- [ ] **Step 1: Import + state.** Thêm import (cạnh import stories_repository):

```dart
import '../../data/repositories/categories_repository.dart';
```

Thêm state fields ngay SAU `bool _rankingLoading = true;`:

```dart
  // ── 3 khối data thật (độc lập với explore/StoriesNotifier) ──
  Book? _editorPick;                          // null → fallback value.first
  List<(Category, List<Book>)> _shelves = const []; // kệ < 3 truyện đã bị loại
  List<Book> _trending = const [];            // rỗng → ẩn section
```

- [ ] **Step 2: Load methods.** Thêm SAU method `_loadRanking` (sau dấu `}` của nó):

```dart
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
    await Future.wait([_loadEditorPick(lang), _loadShelves(lang), _loadTrending(lang)]);
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
```

- [ ] **Step 3: Gọi load.** Trong `initState`, SAU `_loadRanking();` thêm:

```dart
    _loadHomeFeeds();
```

Trong `build`, trong `addPostFrameCallback` chỗ đổi ngôn ngữ, SAU `_loadRanking();` thêm:

```dart
        _loadHomeFeeds(); // 3 khối data thật cũng theo ngôn ngữ nội dung
```

Đổi `onRefresh` của RefreshIndicator từ:

```dart
          onRefresh: () => context.read<StoriesNotifier>().loadExplore(forceRefresh: true),
```

thành:

```dart
          onRefresh: () => Future.wait([
            context.read<StoriesNotifier>().loadExplore(forceRefresh: true),
            _loadHomeFeeds(),
            _loadRanking(),
          ]),
```

- [ ] **Step 4: `_content` — dùng data thật.** Trong `AsyncData(:final value) => [`:

4a. Thay `_editorHero(context, value.first),` bằng:

```dart
          _editorHero(context, _editorPick ?? value.first),
```

4b. Thay khối kệ:

```dart
          // ── Bộ sưu tập theo chủ đề (thiết kế anh/home/2.png) ──
          for (final c in _collections(value)) ...[
            _sectionHeader(context, c.$1, onMore: () {}, moreLabel: 'More'),
            _collectionRail(context, c.$2),
          ],
```

bằng:

```dart
          // ── Kệ theo thể loại nhiều truyện nhất (data thật /stories/categories/top) ──
          for (final s in _shelves) ...[
            _sectionHeader(context, s.$1.name,
                onMore: () => context.push('/category/${s.$1.id}?name=${Uri.encodeComponent(s.$1.name)}'),
                moreLabel: 'More'),
            _collectionRail(context, s.$2),
          ],
```

4c. Thay:

```dart
          _sectionHeader(context, 'New & Trending', onMore: () {}),
          _bookRail(context, value.reversed.toList()),
```

bằng:

```dart
          // ── New & Trending (data thật /stories/trending, window week) — rỗng thì ẩn ──
          if (_trending.isNotEmpty) ...[
            _sectionHeader(context, 'New & Trending'),
            _bookRail(context, _trending),
          ],
```

(`_sectionHeader` không truyền `onMore` → nút View All tự ẩn — hàm đã hỗ trợ sẵn.)

- [ ] **Step 5: XOÁ hàm `_collections`** (toàn bộ hàm + doc comment của nó, dòng 129-149 bản gốc: từ `/// Nhóm truyện thành các kệ theo chủ đề...` đến hết `}`).

- [ ] **Step 6: `_editorHero` — thẻ → chi tiết, Read Now → reader.** Trong `_editorHero`:

6a. Đổi `onTap` của GestureDetector ngoài cùng:

```dart
        onTap: () => context.push('/book/${b.id}'),
```

6b. Bọc Container nút "Read Now" (Container có `child: Text('Read Now  →', ...)`) trong GestureDetector riêng:

```dart
                    GestureDetector(
                      onTap: () => context.push('/reader/${b.id}'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                        decoration: BoxDecoration(color: const Color(0xFFFBF3E3), borderRadius: rounded(24)),
                        child: Text('Read Now  →', style: AppType.btn(size: 14, color: const Color(0xFF7A3B55))),
                      ),
                    ),
```

- [ ] **Step 7: Verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze` → 0 lỗi/0 cảnh báo (đặc biệt: không còn tham chiếu `_collections`).
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/screens/novel/novel_home_screen.dart
git commit -m "feat(novel): Home data thật — Editor's Pick recommended, kệ top-category, trending week

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Verify toàn bộ + docs

**Files:**
- Modify: `CHANGELOG.md` (thêm mục vào entry `## 2026-07-15`), `lib/screens/novel/README.md` (row home + row màn mới), `lib/data/README.md` (bảng repositories)

**Interfaces:** không — task tài liệu + verify.

- [ ] **Step 1: Full verify**

```bash
"/d/SetupC/flutter/bin/flutter.bat" test
"/d/SetupC/flutter/bin/flutter.bat" analyze
```

Expected: test PASS toàn bộ (59 = 56 + 3 mới); analyze 0 lỗi/0 cảnh báo.

- [ ] **Step 2: `CHANGELOG.md`** — trong entry `## 2026-07-15`, SAU section `### Fix hiển thị chữ` (trước `---`), thêm:

```markdown
### Novel Home — data thật
- **Editor's Pick** lấy từ `/stories/recommended` (admin đề cử; fallback truyện đầu explore); bấm thẻ → trang chi tiết, nút Read Now → đọc ngay.
- **3 kệ chủ đề** theo `/stories/categories/top` (tên thể loại thật, theo ngôn ngữ nội dung) + 9 truyện/kệ qua explore theo category; kệ < 3 truyện tự ẩn; bỏ logic xoay vòng giả. Nút **More** → màn mới `/category/:id` (danh sách theo thể loại, cuộn vô hạn).
- **New & Trending** từ `/stories/trending` (kỳ tuần — khác Hot Ranking đang theo ngày); rỗng/lỗi thì ẩn section; bỏ nút View All giả.
- 3 khối load song song, cache-first (SWR key theo ngôn ngữ), lỗi khối nào fallback/ẩn khối đó.
```

- [ ] **Step 3: `lib/screens/novel/README.md`** — trong bảng file:

3a. Row `home` (dòng có `Novel Home`): thay mô tả cụm về nguồn data — tìm dòng của `novel_home_screen.dart` và thay phần mô tả sau dấu `|` cuối bằng:

```
Header "Reading", Editor's Pick (`/stories/recommended`, fallback explore), Continue Reading, For You, Hot Ranking (podium + kỳ), 3 kệ theo `/stories/categories/top` (More → `/category/:id`), New & Trending (`/stories/trending`, tuần). |
```

3b. Thêm row mới ngay dưới row `for_you_screen.dart`:

```markdown
| `category_stories_screen.dart` | Truyện theo thể loại | `/category/:id?name=` | Đích nút "More" của kệ Home; list dọc + infinite scroll (`explore(categoryId, page)`). |
```

- [ ] **Step 4: `lib/data/README.md`** — bảng Cấu trúc, row `repositories/stories_repository.dart`: cuối mô tả hiện có, thêm trước dấu `|` đóng:

```
`recommended()`/`trending()` (+`cachedRecommended`/`cachedTrending`) cho Novel Home.
```

Row `categories_repository` (nếu chưa có thì thêm sau row stories):

```markdown
| `repositories/categories_repository.dart` | `getCategories(lang)` + `topCategories(limit,lang)` (kệ Home) + bản `cached*` đồng bộ. |
```

- [ ] **Step 5: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add CHANGELOG.md lib/screens/novel/README.md lib/data/README.md
git commit -m "docs: Novel Home data thật (CHANGELOG + README novel/data)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
