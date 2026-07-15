# Novel Home — Data thật (recommended / kệ thể loại / trending) — Design

> Ngày: 2026-07-15 · App: NovelVerse Flutter (thuần app — BE đã có sẵn endpoint) · Trạng thái: design đã duyệt (chốt từng khối với user), chờ review → plan.
> Màn: `lib/screens/novel/novel_home_screen.dart`. Layout/thứ tự section GIỮ NGUYÊN (chốt Khối 4); nhãn tiếng Anh giữ nguyên đợt này.

## 1. Vấn đề hiện tại

| Khối | Hiện trạng |
|---|---|
| Editor's Pick | Lấy `value.first` của explore — không phải truyện admin đề cử; bấm thẻ nhảy thẳng reader |
| 3 kệ chủ đề | Tiêu đề hardcode EN; không đủ truyện thì **xoay vòng cả list** (giả); nút More noop |
| New & Trending | Data = list explore **đảo ngược** (giả); View All noop |

## 2. Endpoint BE dùng (đã đối chiếu `backend-port/be/src/stories/stories.controller.ts`)

| Endpoint | Query | Trả về | Dùng cho |
|---|---|---|---|
| `GET /stories/recommended` | `limit`, `lang` | list story (đề cử + rating ≥ 2.5) | Editor's Pick (`limit=1`) |
| `GET /stories/categories/top` | `limit`, `lang` | list category nhiều truyện nhất (BE cache 1h) | Tiêu đề 3 kệ (`limit=3`) |
| `GET /stories/explore` | `categoryId`, `limit`, `lang`, `page` | PagedBooks | Truyện trong kệ (`limit=9`) + màn `/category/:id` (phân trang) |
| `GET /stories/trending` | `limit`, `page`, `lang`, `trendWindow` (default `week`) | = explore sort=views | New & Trending (`limit=10`, window mặc định `week` — khác Hot Ranking đang mặc định Today) |

## 3. Thiết kế theo khối (đã chốt từng khối 2026-07-15)

### 3.1. Editor's Pick
- `StoriesRepository.recommended({int limit = 1, String lang})` → `List<Book>` (map qua `BookMapper.fromJson`, `unwrapList` như categories).
- Home giữ state riêng `_editorPick` (pattern như `_ranking`): load ở `initState` + reload khi đổi `contentLang`. Lỗi/rỗng → `null` → **fallback `value.first`** như hiện tại (thẻ không bao giờ trống).
- Hành vi bấm: **thẻ** → `context.push('/book/${b.id}')`; **nút "Read Now"** → `context.push('/reader/${b.id}')` (GestureDetector riêng cho nút, bọc trong thẻ).

### 3.2. Kệ bộ sưu tập (3 kệ)
- `CategoriesRepository.topCategories({int limit = 3, String lang})` → `List<Category>` — gọi `GET /stories/categories/top` (mapper `CategoryMapper` hiện có).
- Home state `_shelves: List<(Category, List<Book>)>`: lấy top 3 category → gọi song song (`Future.wait`) `explore(categoryId: c.id, limit: 9, lang)`; kệ nào **< 3 truyện thì loại**. XOÁ hẳn `_collections()` xoay vòng giả.
- Tiêu đề kệ = `category.name` (đã theo ngôn ngữ nội dung từ BE).
- **More** → `context.push('/category/${c.id}?name=${Uri.encodeComponent(c.name)}')`.

### 3.3. Màn mới `/category/:id` — `CategoryStoriesScreen`
- File mới `lib/screens/novel/category_stories_screen.dart`; route thêm vào `lib/router.dart` (cạnh `/for-you`): đọc `state.pathParameters['id']` + `state.uri.queryParameters['name']` làm tiêu đề AppBar.
- UI: list dọc mỗi hàng = bìa nhỏ + tên + `⭐ rating · reads` (tái dùng `CoverImage`, style hàng như `_rankRow` bỏ badge hạng); tap → `/book/:id`.
- Data: `explore(categoryId, page, limit: 20, lang)` — **infinite scroll**: `ScrollController`, gần cuối (`maxScrollExtent - 400`) và `hasMore` → load trang kế; skeleton lúc đầu, error + Thử lại (pattern `_errorView` của Home).

### 3.4. New & Trending
- `StoriesRepository.trending({int limit = 10, String lang, String window = 'week'})` → `List<Book>` — gọi `GET /stories/trending` (đọc `unwrapList` — response cùng shape explore).
- Home state `_trending` (pattern `_ranking`); thay `_bookRail(context, value.reversed.toList())` bằng rail từ `_trending`; rỗng/lỗi → **ẩn section** (cả header). **Bỏ nút View All** (noop) ở v1 — tab Xu hướng đã có, điều hướng chéo tab để sau.

### 3.5. Kỹ thuật chung
- Cả 3 nguồn mới load theo `contentLang`, reload khi đổi ngôn ngữ — móc vào chỗ `_lastLang` hiện có (cùng chỗ gọi `_loadRanking()`).
- Mỗi khối **độc lập**: lỗi khối nào fallback/ẩn khối đó, không chặn Home; explore chính (For You) giữ nguyên qua `StoriesNotifier`.
- Cache: `JsonCache` SWR key theo lang — `cache.home.recommended.<lang>`, `cache.home.topcats.<lang>`, `cache.home.trending.<lang>` (đọc cache hiện ngay nếu có → fetch nền cập nhật — cùng tinh thần explore; kệ theo category KHÔNG cache riêng ở v1 vì phụ thuộc top-cats, giữ đơn giản).
- KHÔNG đụng: Hot Ranking, Continue Reading, For You, TopBarShared, Discover/Trending tab, BE.

## 4. Test

- `stories_repository`: `recommended()`/`trending()` parse đúng qua fake ApiClient (pattern `_FakeApi` của test read-along); lỗi API → throw để UI fallback.
- `categories_repository`: `topCategories()` parse list category.
- Home logic thuần tách được: hàm lọc kệ `< 3 truyện` (nếu tách helper thuần thì test; không thì thôi — logic 1 dòng where).
- `flutter analyze` 0 lỗi/0 cảnh báo; full `flutter test` pass.

## 5. Quyết định đã chốt (từng khối, 2026-07-15)

1. Editor's Pick: data `/stories/recommended` + fallback `value.first`; thẻ → chi tiết, Read Now → reader.
2. Kệ: top categories thật + explore theo category; More → màn `/category/:id` list dọc phân trang.
3. New & Trending: giữ nhãn + data `/stories/trending` (window week); ẩn View All v1.
4. Layout: giữ nguyên bố cục; không Việt hoá nhãn đợt này.
