# `lib/screens/audio/` — Chế độ Audio (nghe nhạc/audiobook)

Accent: **plum**. Dữ liệu từ `Demo.songs` / `Demo.charts` (hoặc backend qua `MusicNotifier` khi bật). Phát thật qua `AppState` (`just_audio`).

## Files
| File | Màn | Route | Điểm chính |
|---|---|---|---|
| `audio_home_screen.dart` | Audio Home (tab) | `/home` tab 0 | Continue Listening, chip thể loại, "Made for You"/"New Releases" rail, Charts rail. Dùng lại **`TopBarShared`** (import từ `novel/novel_home_screen.dart`). Bấm bài → `app.play(...)` → `/player`. |
| `audio_library_screen.dart` | Library (tab) | tab 1 | Audiobook continue (→ `/audiobook`), danh sách Songs (♥ toggle thật), link Favourites. |
| `audio_charts_screen.dart` | Charts (tab) | tab 2 | Bảng xếp hạng chart (màu rank) → `/album/:i`. |
| `album_detail_screen.dart` | Album/Chart detail | `/album/:i` | Bìa lớn + **Play all** (set hàng đợi `queue: tracks`), danh sách track → `playSong`. |
| `music_player_screen.dart` | Trình phát nhạc | `/player` | Cover lớn, ♥ (`toggleLike`), **progress + tua thật** (`ValueListenableBuilder` trên `app.position`), play/prev/next, "Up Next". |
| `audiobook_player_screen.dart` | Trình phát audiobook | `/audiobook` | Như player + tua ±10/30s, tốc độ/sleep (pill demo), danh sách Episodes (3 đầu free). |
| `favourites_screen.dart` | Yêu thích | `/favourites` | Liked Songs (`app.likedSongs`, empty-state khi rỗng) + grid album yêu thích. Play all theo `queue: liked`. |

## Pattern phát nhạc (quan trọng)
- Phát 1 bài: `app.play(title, author, cover, url)` (chỉ set metadata nếu `url` rỗng).
- Phát kèm hàng đợi (next/prev đúng): `app.playSong(song, queue: danhSách)`.
- **Chỉ thanh tiến trình** dùng `ValueListenableBuilder<Duration>(valueListenable: app.position)` →
  không rebuild cả màn theo tick. **Giữ pattern này** khi thêm UI player.

## Khi sửa
- Engine audio = **`just_audio`** (đã đổi từ audioplayers): ưu tiên HLS m3u8 (Cloudflare) qua
  `Song.hlsUrl`, fallback MP3 cache; preload 30s + preload bài kế (playlist). Xem
  [docs/06 §3.2](../../../docs/06-cache-va-tai-nguyen.md) + [docs/07 §audio](../../../docs/07-noi-backend.md).
- `like` đang khoá theo **title** (prototype) — đổi sang **id** khi có dữ liệu thật.
