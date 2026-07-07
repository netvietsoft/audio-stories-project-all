# 02 — Cấu trúc thư mục (NovelVerse Flutter)

> Bản đồ `lib/` + vai trò từng file. Dựa trên code thật. Cập nhật: 2026-07-02.

═══════════════════════════════════════════════════════════════════════
## 1. CÂY THƯ MỤC `lib/`
═══════════════════════════════════════════════════════════════════════

```
lib/
├── main.dart                          entrypoint (MultiProvider + MaterialApp.router)
├── router.dart                        go_router: toàn bộ route
│
├── models/
│   ├── models.dart                    kiểu dữ liệu: Book, Chapter, Song, Chart,
│   │                                  Category, CoinPack, Plan, Gift, AppUser
│   │                                  + enum ChapterState
│   └── demo_data.dart                 Demo.* — DỮ LIỆU TĨNH (fixture/fallback khi
│                                      tắt backend): books, songs, charts, packs...
│
├── api/                               TẦNG GỌI BACKEND (dio)
│   ├── api_env.dart                   ApiEnv: USE_BACKEND / API_ENV / API_BASE_URL
│   ├── api_endpoints.dart             tất cả path endpoint (1 nơi)
│   ├── api_client.dart                ApiClient: bóc {data,meta}, Bearer, refresh-401,
│   │                                  resolveRedirect (302); + unwrapList()
│   ├── api_exception.dart             ApiException (code/message/status)
│   └── token_store.dart              TokenStore (flutter_secure_storage) access/refresh
│
├── data/                              REPOSITORY + MAPPER + CACHE (thay Demo khi online)
│   ├── repositories/                  stories, music, categories, audio, auth
│   ├── mappers/                       book, chapter, song, category, user (JSON→model)
│   └── cache/json_cache.dart          cache JSON (prefs + timestamp) — SWR
│
├── state/
│   ├── app_state.dart                 AppState (ChangeNotifier) — STORE toàn cục
│   ├── async_value.dart               AsyncValue: AsyncLoading/AsyncData/AsyncError
│   ├── auth_notifier.dart             AuthNotifier — phiên đăng nhập, restore()
│   ├── stories_notifier.dart          StoriesNotifier — explore (SWR, KHÔNG fallback demo)
│   └── music_notifier.dart            MusicNotifier — nhạc (SWR, CÓ fallback demo)
│
├── theme/
│   ├── app_palette.dart               AppPalette (ThemeExtension) Light+Dark + brand
│   ├── app_type.dart                  AppType — text style Spectral/Figtree
│   ├── app_dimens.dart                Gap (spacing) + Radii (bo góc) + rounded()
│   └── app_theme.dart                 AppTheme.light()/dark() — dựng ThemeData
│
├── l10n/                              I18N (ĐA NGÔN NGỮ HIỂN THỊ) — xem l10n/README.md
│   ├── app_en.arb / app_vi.arb        khoá chuỗi UI (template EN + dịch VI)
│   ├── l10n_ext.dart                  context.l10n.<key>
│   └── gen/                           AppLocalizations (sinh tự động — đừng sửa tay)
│
├── utils/
│   └── format.dart                    helper định dạng (số/thời lượng...)
│
├── widgets/                           COMPONENT DÙNG CHUNG
│   ├── cover_image.dart               CoverImage — bìa asset/URL + placeholder gradient
│   └── sheets.dart                    bottom-sheet: unlock/gift/comment/rating
│
└── screens/                           UI THEO FEATURE
    ├── splash_screen.dart             splash 1100ms → /home
    ├── app_shell.dart                 khung chính: IndexedStack + bottom nav + mini-player
    ├── profile_screen.dart            tab Profile (chung 2 chế độ)
    │
    ├── onboarding/
    │   └── onboarding_screen.dart     onboarding (route /onboarding)
    │
    ├── auth/
    │   └── login_screen.dart          /login — đăng nhập
    │
    ├── novel/                         CHẾ ĐỘ NOVEL (đọc truyện)
    │   ├── novel_home_screen.dart     tab Home
    │   ├── discover_screen.dart       tab Discover
    │   ├── trending_screen.dart       tab Trending
    │   ├── for_you_screen.dart        /for-you — danh sách "For You" (từ View All Home)
    │   ├── book_detail_screen.dart    /book/:id — chi tiết truyện
    │   └── reader_screen.dart         /reader/:id — đọc chương
    │
    ├── audio/                         CHẾ ĐỘ AUDIO (nghe)
    │   ├── audio_home_screen.dart     tab Listen
    │   ├── audio_library_screen.dart  tab Library
    │   ├── audio_charts_screen.dart   tab Charts
    │   ├── album_detail_screen.dart   /album/:i
    │   ├── music_player_screen.dart   /player — trình phát nhạc
    │   ├── audiobook_player_screen.dart /audiobook — trình phát audiobook
    │   └── favourites_screen.dart     /favourites — bài đã thích
    │
    ├── money/                         COIN / VIP / VÍ
    │   ├── coin_store_screen.dart     /coins — mua coin (CoinPack)
    │   ├── subscription_screen.dart   /subscription — gói VIP (Plan)
    │   └── wallet_screen.dart         /wallet — ví coin
    │
    └── account/
        └── account_screens.dart       gộp nhiều màn account: EditProfile,
                                       LanguageSettings, ContentSettings,
                                       ClaimCopyright, BecomeAuthor
```

═══════════════════════════════════════════════════════════════════════
## 2. QUY ƯỚC TỔ CHỨC
═══════════════════════════════════════════════════════════════════════

1. **Nhóm theo feature, không theo loại.** `screens/novel`, `screens/audio`,
   `screens/money`, `screens/account` — mỗi nhóm là một vùng nghiệp vụ. Tab/màn
   dùng chung cả 2 chế độ (`profile_screen.dart`, `app_shell.dart`, `splash_screen.dart`)
   để thẳng ở `screens/`.

2. **Một file = một màn** (trừ `account_screens.dart` gộp các màn cài đặt nhỏ, và
   các `_Widget` private đặt cùng file màn dùng nó — vd `_MiniPlayer`, `_BottomNav`
   trong `app_shell.dart`).

3. **Component thực sự dùng chung** mới tách ra `widgets/`. Widget chỉ dùng 1 màn →
   để private (prefix `_`) trong file màn đó. → Đừng nhồi widget cục bộ vào `widgets/`.

4. **Token UI tập trung ở `theme/`** — không rải màu/spacing hex khắp nơi. Xem [05](05-components-dung-chung.md).

5. **Dữ liệu tách khỏi UI**: kiểu ở `models/models.dart`, nội dung mẫu ở
   `models/demo_data.dart`. Khi nối backend, lớp dữ liệu mới (repository/service)
   thay `Demo`, **không** sửa rải rác trong screens — xem [07](07-noi-backend.md).

═══════════════════════════════════════════════════════════════════════
## 3. ĐẶT FILE MỚI Ở ĐÂU?
═══════════════════════════════════════════════════════════════════════

| Bạn thêm… | Đặt ở… |
|---|---|
| Màn hình mới thuộc novel/audio/money/account | `screens/<feature>/<ten>_screen.dart` + khai route trong `router.dart` |
| Màn dùng chung 2 chế độ | `screens/<ten>_screen.dart` |
| Widget tái dùng ≥2 màn | `widgets/<ten>.dart` |
| Kiểu dữ liệu mới | `models/models.dart` |
| Màu/spacing/text-style mới | `theme/app_palette.dart` · `app_dimens.dart` · `app_type.dart` (KHÔNG hardcode tại chỗ) |
| State/global mới (cờ, bộ đếm, dữ liệu chia sẻ) | thêm field + method vào `state/app_state.dart` |
| Endpoint backend mới | thêm hằng vào `api/api_endpoints.dart` (KHÔNG rải string path trong repo) |
| Nguồn dữ liệu mới (gọi API + cache + map) | `data/repositories/<x>_repository.dart` + `data/mappers/<x>_mapper.dart`; inject ở `main.dart` |
| State tải của MỘT màn list/detail | `state/<x>_notifier.dart` (ChangeNotifier + `AsyncValue`) — KHÔNG nhồi vào `AppState` |
| Chuỗi UI cần dịch | thêm khoá vào `l10n/app_en.arb` + `app_vi.arb` → `flutter gen-l10n` (xem `lib/l10n/README.md`) |
| Token đường dẫn assets | khai thêm trong `pubspec.yaml` mục `flutter/assets` |

> Khi thêm route: nhớ import màn trong `router.dart` và đặt `path` nhất quán
> (`/feature` hoặc `/feature/:param`). Tham số đường dẫn lấy qua `state.pathParameters`,
> query qua `state.uri.queryParameters` (xem `reader_screen` lấy `?ch=`).
