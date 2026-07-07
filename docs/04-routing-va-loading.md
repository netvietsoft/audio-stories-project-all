# 04 — Routing & Loading (NovelVerse Flutter)

> Điều hướng `go_router` (`lib/router.dart`) + khung `AppShell` + giải pháp loading.
> Dựa trên code thật. Cập nhật: 2026-07-02.

═══════════════════════════════════════════════════════════════════════
## 1. BẢNG ROUTE (`lib/router.dart`)
═══════════════════════════════════════════════════════════════════════

`appRouter = GoRouter(initialLocation: '/', routes: [...])`.

| Path | Màn | Tham số | Ghi chú |
|---|---|---|---|
| `/` | `SplashScreen` | — | initial; tự `go('/home')` sau 1100ms. |
| `/home` | `AppShell` | — | khung 4 tab + bottom nav + mini-player. |
| `/onboarding` | `OnboardingScreen` | — | chưa gắn vào boot flow mặc định. |
| `/book/:id` | `BookDetailScreen` | path `id` | chi tiết truyện. |
| `/reader/:id` | `ReaderScreen` | path `id`, query `?ch=` | `initialChapter` parse từ `?ch`. |
| `/for-you` | `ForYouScreen` | — | danh sách "For You" (mở từ View All ở Home). |
| `/login` | `LoginScreen` | — | đăng nhập (auth). |
| `/player` | `MusicPlayerScreen` | — | trình phát nhạc. |
| `/audiobook` | `AudiobookPlayerScreen` | — | trình phát audiobook. |
| `/album/:i` | `AlbumDetailScreen` | path `i` (int) | index album trong Demo. |
| `/favourites` | `FavouritesScreen` | — | bài đã thích. |
| `/coins` | `CoinStoreScreen` | — | mua coin. |
| `/subscription` | `SubscriptionScreen` | — | gói VIP. |
| `/wallet` | `WalletScreen` | — | ví coin. |
| `/edit-profile` | `EditProfileScreen` | — | (account_screens.dart) |
| `/language` | `LanguageSettingsScreen` | — | (account_screens.dart) |
| `/content-settings` | `ContentSettingsScreen` | — | (account_screens.dart) |
| `/claim-copyright` | `ClaimCopyrightScreen` | — | (account_screens.dart) |
| `/become-author` | `BecomeAuthorScreen` | — | (account_screens.dart) |

**Điều hướng**: `context.go('/x')` (thay stack) hoặc `context.push('/x')` (chồng lên).
Lấy tham số: `state.pathParameters['id']`, `state.uri.queryParameters['ch']`.

> Tab BÊN TRONG `/home` KHÔNG phải route riêng — đổi tab không đẩy URL. Chỉ số tab
> giữ ở **`AppState.shellTab`** (không còn `_index` cục bộ) để màn đẩy (vd Reader) điều
> hướng về đúng tab. Chỉ các màn "chi tiết" mới là route push.

═══════════════════════════════════════════════════════════════════════
## 2. KHUNG CHÍNH `AppShell` (`screens/app_shell.dart`)
═══════════════════════════════════════════════════════════════════════

```
Scaffold
 ├─ body: IndexedStack(index: shellTab, children: pages)  ← GIỮ state 4 tab khi đổi qua lại
 └─ bottomNavigationBar: Column
      ├─ if (hasPlaying) _MiniPlayer()                     ← chỉ hiện khi đang phát
      └─ _BottomNav(index, accent, audioMode, onTap)       ← onTap → app.setShellTab(i)
```

- **`IndexedStack`**: cả 4 tab dựng sẵn, chỉ hiện 1 → đổi tab **giữ nguyên scroll/state**
  từng tab (không rebuild lại từ đầu). Đánh đổi: tốn RAM hơn lazy, chấp nhận được với 4 tab.
- **`pages` theo `mode`**: Novel = `[NovelHome, Discover, Trending, Profile]`;
  Audio = `[AudioHome, AudioLibrary, AudioCharts, Profile]`.
- **`accent` theo `mode`**: Novel terracotta, Audio plum.
- Shell dùng `context.select` cho `mode`, `shellTab` và `hasPlaying` → **không** rebuild
  theo tick vị trí phát (xem [03 §3](03-state-va-store.md)).
- Nhãn tab qua **i18n** (`context.l10n.nav*`) — đổi `uiLang` dịch ngay.
- `_MiniPlayer` (`watch<AppState>`): bìa + title/author + nút play/pause (`togglePlay`)
  + đóng (`stop`). Hiện toàn cục trên mọi tab khi `nowPlayingTitle != null`.

═══════════════════════════════════════════════════════════════════════
## 3. GIẢI PHÁP LOADING — HIỆN TẠI
═══════════════════════════════════════════════════════════════════════

1. **Splash** (`splash_screen.dart`): logo + tên + `CircularProgressIndicator` +
   `Timer(1100ms)` → `go('/home')`. **Delay thương hiệu** cố định; song song `main()` đã
   chạy `authNotifier.restore()` ở nền (không chặn boot). Chưa phải "gate" chờ Future.
2. **Trong app**:
   - **Tắt backend (mặc định)**: dữ liệu đồng bộ (`Demo`/rỗng) ⇒ vẽ ngay, không spinner.
   - **Bật backend** (`USE_BACKEND=true`): màn list/detail đọc notifier dạng **`AsyncValue`**
     (`AsyncLoading/AsyncData/AsyncError`) → hiện `CircularProgressIndicator` khi loading,
     thông điệp + (tuỳ màn) nút thử lại khi lỗi. Cache local (SWR) hiện ngay để đỡ trắng màn.
3. **Ảnh**: `CoverImage` hiện **placeholder gradient + tên** khi asset/URL thiếu hoặc lỗi
   (`errorBuilder`/`errorWidget`) + `placeholder` khi tải ảnh mạng. Xem [05](05-components-dung-chung.md)/[06](06-cache-va-tai-nguyen.md).
4. **Audio**: `play()`/`playSong()` bọc try/catch; lỗi phát → `playing=false`. Buffer hiện
   qua `AppState.buffered` (thanh đệm); chưa có spinner "buffering" riêng.

═══════════════════════════════════════════════════════════════════════
## 4. GIẢI PHÁP LOADING — ĐỀ XUẤT KHI NỐI BACKEND
═══════════════════════════════════════════════════════════════════════

Khi dữ liệu chuyển sang async (gọi API), cần trạng thái loading thật:

1. **Splash thành "gate"** (CHƯA — hiện `restore()` chạy nền, splash vẫn delay cố định):
   thay `Timer` cố định bằng chờ `Future.wait([...])`:
   - khôi phục token (secure storage) + gọi `/auth/me` → quyết định vào `/home`
     hay `/onboarding`/login;
   - prefetch tối thiểu cho Home (vài request song song).
   Đặt timeout + lối thoát khi mạng hỏng (vào app ở chế độ offline/cache).
2. **Per-screen async** (ĐÃ LÀM — cơ chế): mỗi màn list/detail đọc `ChangeNotifier` riêng
   (`StoriesNotifier`/`MusicNotifier`) với cờ `loading/error/data` gói trong `AsyncValue`
   (giữ `AppState` gọn cho global). Hiện dùng spinner; CÒN LẠI: đổi sang **skeleton**
   (khối xám bo góc) cho list — hợp gu "trang sách" hơn.
3. **Audio buffering**: nghe `onPlayerStateChanged` để hiện trạng thái buffering khi
   nguồn là URL mạng/HLS (khác với asset local hiện tại).
4. **Empty/error state dùng chung**: tách 1 widget `StatusView(loading/empty/error,
   onRetry)` ở `widgets/` để mọi màn dùng nhất quán.
5. **Lỗi**: BE bọc lỗi `{ error:{code,message}, meta }` (xem `../backend/docs/01`).
   Bind thông điệp theo `code`, có nút Retry.

> Nguyên tắc: thêm loading **không** làm phình `AppState`. Global store giữ state chia
> sẻ (auth, player, theme); trạng thái tải của từng màn để ở controller/notifier của màn đó.
