# `lib/state/` — Store toàn cục

Tài liệu đầy đủ: [docs/03 — State & Store](../../docs/03-state-va-store.md). File này tóm tắt cục bộ.

## Files
| File | Vai trò |
|---|---|
| `app_state.dart` | `AppState` — state toàn cục (theme/mode/coin/like/unlock + player + persist). |
| `async_value.dart` | `AsyncValue` sealed (loading/data/error) cho các notifier feature. |
| `stories_notifier.dart` | `StoriesNotifier` — explore truyện (ensureLoaded + fallback Demo). |
| `music_notifier.dart` | `MusicNotifier` — danh sách nhạc (ensureLoaded + fallback Demo). |
| `auth_notifier.dart` | `AuthNotifier` — trạng thái đăng nhập + `AppUser` (login/logout/restore). |

> `AppState` = state chia sẻ khắp app; các *Notifier* = state theo vùng dữ liệu (gọi
> repository ở `lib/data`). Màn chi tiết (BookDetail/Reader) dùng thẳng `FutureBuilder`.

## `AppState` — nhóm chức năng
- **Theme**: `themeMode`/`isDark`, `toggleTheme()`.
- **Chế độ**: `mode` (`AppMode.novel/audio`), `setMode()`.
- **Coin/VIP**: `coins`, `streak`, `vip`; `spendCoins(n)→bool`, `addCoins(n)`.
- **Mở khoá chương**: `_unlocked` (Set `"bookId:n"`); `isUnlocked`, `unlockChapter`.
- **Yêu thích nhạc**: `_likedSongs` (Set title); `isLiked`, `toggleLike`, `likedSongs`.
- **Player + hàng đợi**: `nowPlaying*`, `playing`, `position`/`duration` (`ValueNotifier`), `playSong/play/togglePlay/next/prev/seek/stop`.
- **Persist**: `init()` (nạp từ `shared_preferences`, gọi 1 lần ở `main`), tự ghi khi đổi theme/mode/coin/liked/unlocked.

## 2 quy tắc PHẢI nhớ (đừng phá)
1. **`position`/`duration` là `ValueNotifier`**, KHÔNG qua `notifyListeners` (đổi ~5 lần/giây).
   UI lắng nghe bằng `ValueListenableBuilder` để chỉ slider/đồng hồ rebuild — không phải cả cây.
2. **Đọc state**: `context.select` (1 giá trị) / `context.watch` (nhiều) / `context.read` (chỉ gọi method trong callback).

## Khi sửa
- State chia sẻ nhiều màn → thêm vào đây. State 1 màn → giữ cục bộ ở màn đó.
- Cần persist field mới → thêm khoá + đọc trong `init()` + ghi trong setter (xem [docs/03 §6](../../docs/03-state-va-store.md)).
- Online: coin/VIP/unlocked nguồn sự thật ở backend; store local là cache/mirror ([docs/07 §4](../../docs/07-noi-backend.md)).
