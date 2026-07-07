# 01 — Kiến trúc tổng quan (NovelVerse Flutter)

> Đọc trước khi sửa bất cứ thứ gì. Dựa trên code thật trong `lib/`. Cập nhật: 2026-07-02.

═══════════════════════════════════════════════════════════════════════
## 1. STACK & PHỤ THUỘC
═══════════════════════════════════════════════════════════════════════

Khai trong `pubspec.yaml`:

| Package | Vai trò | Ghi chú |
|---|---|---|
| `flutter` (SDK ^3.12.2) | Framework UI | Material 3 (`useMaterial3: true`). |
| `provider ^6.1.5` | **State management** | 1 store toàn cục `AppState` (xem [03](03-state-va-store.md)). |
| `go_router ^17.3.0` | **Điều hướng** declarative | Cấu hình ở `lib/router.dart` (xem [04](04-routing-va-loading.md)). |
| `just_audio ^0.9.42` | **Phát audio** (ExoPlayer/media3) | HLS m3u8 (Cloudflare) + MP3 cache (`LockCachingAudioSource`) + preload 30s + playlist preload bài kế. Xem [07 §audio](07-noi-backend.md). |
| `google_fonts ^8.1.0` | Font Spectral (serif) + Figtree (sans) | Tải runtime; cân nhắc bundle font khi release (xem [06](06-cache-va-tai-nguyen.md)). |
| `cupertino_icons` | Icon iOS | — |
| `shared_preferences ^2.3.2` | **Persist** state người dùng (theme/mode/coin/liked/unlocked/lang/lastRead) + cache JSON (`JsonCache`) | nạp 1 lần trong `main()` qua `AppState.init()` — xem [03 §6](03-state-va-store.md). |
| `dio ^5.7.0` | **HTTP client** gọi backend NestJS | 1 `ApiClient` bóc envelope `{data,meta}` + auto-refresh 401 (xem `lib/api/`, [07](07-noi-backend.md)). |
| `flutter_secure_storage ^9.2.2` | **Token** (access/refresh) an toàn (KeyStore/Keychain) | `TokenStore` — auth mobile (xem [07 §4b](07-noi-backend.md)). |
| `cached_network_image ^3.4.1` | **Cache ảnh mạng** (cover R2/Cloudflare) ra đĩa | `CoverImage` dùng cho URL (xem [05 §5](05-components-dung-chung.md)/[06 §3.1](06-cache-va-tai-nguyen.md)). |
| `flutter_localizations` + `intl ^0.20.2` | **i18n** (đa ngôn ngữ HIỂN THỊ) | gen-l10n từ `lib/l10n/*.arb` (`generate: true`) — xem [`lib/l10n/README.md`](../lib/l10n/README.md). |

Dev: `flutter_lints ^6.0.0` (cấu hình `analysis_options.yaml`).

**Vẫn chưa có** (điểm tích hợp còn lại): local DB lớn (`hive`/`isar`) — hiện dùng
`shared_preferences` cho cache JSON nhỏ; DI (`get_it`/`riverpod`) — hiện inject qua
`provider` ở `main.dart`; code-gen (`freezed`/`json_serializable`) — mapper viết tay;
`just_audio_background` (điều khiển màn khoá / phát nền). Xem [07](07-noi-backend.md).

═══════════════════════════════════════════════════════════════════════
## 2. ENTRYPOINT & CÂY WIDGET GỐC
═══════════════════════════════════════════════════════════════════════

`lib/main.dart`:

`main()` là **async**: `ensureInitialized` → khóa portrait → `AppState.init()` (nạp prefs)
→ dựng **tầng dữ liệu** (`JsonCache`, `ApiClient`, các Repository, `AuthNotifier`) → wire
`apiClient.refreshCallback`/`appState.tokenProvider` → `authNotifier.restore()` (nền) → `runApp`.

```
main() → runApp(NovelVerseApp)
  └─ MultiProvider                                   ← inject store + repo + notifier (DI thủ công)
       ├─ ChangeNotifierProvider.value(AppState)      ← store toàn cục, 1 instance (đã init)
       ├─ ChangeNotifierProvider.value(AuthNotifier)  ← phiên đăng nhập
       ├─ Provider.value(Stories/Music/Categories/AudioRepository)  ← tầng dữ liệu
       ├─ ChangeNotifierProvider(StoriesNotifier)     ← state màn (loading/data/error)
       └─ ChangeNotifierProvider(MusicNotifier)
            └─ Consumer<AppState>                     ← rebuild MaterialApp khi theme/uiLang đổi
                 └─ MaterialApp.router(
                      theme/darkTheme: AppTheme.light()/dark(),
                      themeMode: app.themeMode,        ← sáng/tối điều khiển bởi AppState
                      locale: Locale(app.uiLang),      ← i18n theo AppState.uiLang
                      routerConfig: appRouter,         ← go_router
                    )
```

Điểm cần nhớ:
- **Chỉ 1 `AppState`** cho toàn app, tạo ở gốc. Mọi màn đọc/ghi qua `provider`.
- **DI bằng `provider`** (không `get_it`): repository/notifier tạo 1 lần ở `main`, inject qua
  `MultiProvider`; màn lấy bằng `context.read/watch`.
- `Consumer<AppState>` bọc `MaterialApp` ⇒ đổi `themeMode`/`uiLang` rebuild toàn bộ — đúng và
  rẻ vì chỉ xảy ra khi người dùng đổi theme/ngôn ngữ.
- `MaterialApp.router` ⇒ điều hướng do `go_router` quản, KHÔNG dùng `Navigator.push` route string thủ công (trừ `Navigator.pop` trong sheet/dialog).

═══════════════════════════════════════════════════════════════════════
## 3. CÁC LỚP (LAYERS)
═══════════════════════════════════════════════════════════════════════

Kiến trúc phẳng, hướng feature (không Clean Architecture nhiều tầng — phù hợp quy mô app):

```
┌─────────────────────────────────────────────────────────────┐
│ main.dart            entrypoint + MultiProvider + MaterialApp  │
├─────────────────────────────────────────────────────────────┤
│ router.dart          go_router: bảng route, push màn chi tiết  │
├─────────────────────────────────────────────────────────────┤
│ screens/             UI theo feature (novel / audio / money /  │
│                      account / auth / onboarding) + app_shell  │
│   widgets/           component dùng chung (CoverImage, sheets)  │
│   l10n/              i18n (ARB → AppLocalizations) + context.l10n│
├─────────────────────────────────────────────────────────────┤
│ state/               STORE global (app_state) + notifier theo   │
│                      màn (stories/music/auth) + AsyncValue      │
├─────────────────────────────────────────────────────────────┤
│ data/                repositories/ (stories/music/categories/   │
│                      audio/auth) + mappers/ + cache/ ← BACKEND   │
│ api/                 ApiClient (dio) + env + endpoints + token   │
├─────────────────────────────────────────────────────────────┤
│ models/              kiểu dữ liệu (models.dart) + Demo tĩnh     │
│                      (demo_data.dart) ← fixture/fallback        │
├─────────────────────────────────────────────────────────────┤
│ theme/               token: palette, type, dimens, theme       │
└─────────────────────────────────────────────────────────────┘
```

Hướng phụ thuộc (import) **một chiều**, không vòng:
`screens → (state, widgets, theme, models, data)` · `state → (data, models)` ·
`data → (api, models)` · `widgets → (theme, models, state)` · `api`/`theme`/`models`
không phụ thuộc lớp trên.

═══════════════════════════════════════════════════════════════════════
## 4. LUỒNG KHỞI ĐỘNG (BOOT FLOW)
═══════════════════════════════════════════════════════════════════════

```
runApp → SplashScreen ('/')
   │  Timer 1100ms (splash_screen.dart) — delay thương hiệu. Trong nền, main() đã gọi
   │  authNotifier.restore() (khôi phục phiên qua /auth/me) — KHÔNG chặn boot.
   ▼
context.go('/home') → AppShell
   │  IndexedStack 4 tab theo chế độ (Novel: Home/Discover/Trending/Profile;
   │  Audio: AudioHome/Library/Charts/Profile) + bottom nav + mini-player.
   ▼
Người dùng điều hướng: Home → Book Detail (/book/:id) → Reader (/reader/:id)
                        hoặc Audio → Music/Audiobook Player, Coin/Sub/Wallet…
```

⚠ Splash hiện là **delay cố định**, không chờ tác vụ async (vì dữ liệu là `Demo`
tĩnh). Khi nối backend (auth check, prefetch home) → đổi sang chờ Future + điều
hướng theo trạng thái đăng nhập. Xem [04 §loading](04-routing-va-loading.md) và [07](07-noi-backend.md).

═══════════════════════════════════════════════════════════════════════
## 5. 2 CHẾ ĐỘ NOVEL / AUDIO
═══════════════════════════════════════════════════════════════════════

`AppState.mode` (`enum AppMode { novel, audio }`) quyết định:
- **Tab bar** + **trang** trong `AppShell` (xem `app_shell.dart`).
- **Màu accent**: Novel = terracotta (`AppPalette.terracotta`), Audio = plum (`AppPalette.plum`).
- Đổi chế độ qua `app.setMode(...)` (menu Novel/Audio ở Home).

Đây là trục điều hướng lớn nhất của app — mọi thay đổi UI nên kiểm cả 2 chế độ.

═══════════════════════════════════════════════════════════════════════
## 6. CHẠY & BUILD
═══════════════════════════════════════════════════════════════════════

```bash
cd D:\SetupC\Projects\NovelApp\novelverse
flutter pub get
flutter run                 # chạy trên thiết bị/emulator đang kết nối
flutter analyze             # lint theo analysis_options.yaml
flutter test                # test trong test/
flutter build apk           # release Android
```

> Yêu cầu Dart SDK `^3.12.2` (xem `pubspec.yaml`). Assets khai trong `pubspec.yaml`
> mục `flutter/assets`: `assets/covers/`, `assets/icons/`, `assets/audio/`.
