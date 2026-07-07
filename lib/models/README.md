# `lib/models/` — Kiểu dữ liệu & dữ liệu demo

Tách **shape dữ liệu** (`models.dart`) khỏi **nội dung mẫu** (`demo_data.dart`).
Liên quan: [docs/07 — nối backend](../../docs/07-noi-backend.md) (mapping sang API).

## Files
| File | Nội dung |
|---|---|
| `models.dart` | Các lớp dữ liệu **bất biến** (`const` constructor): `Book`, `Chapter`, `Song`, `Chart`, `CoinPack`, `Plan`, `Gift` + enum `ChapterState`. |
| `demo_data.dart` | `abstract final class Demo` — dữ liệu tĩnh: `books`, `songs`, `charts`, `coinPacks`, `plans`, `gifts`, `genres` + `chaptersFor(book)`. **Nguồn dữ liệu hiện tại của toàn app.** |

## `models.dart` — chi tiết
- **`ChapterState`** `{ free, coin, vip, current }` — trạng thái truy cập chương (quyết định badge + khoá ở Book Detail/Reader).
- **`Book`**: `id, title, author, genre, cover, trope, rating, reads, status, chapters, tag?` (`tag` = VIP|HOT|TOP|NEW).
- **`Chapter`**: `n, title, state, price` (giá coin mặc định 15).
- **`Song`**: `cover, title, author, reads, url` (`url` = path tương đối trong `assets/`, vd `audio/s0.mp3`).
- **`Chart`**: `title, cover, songs`.
- **`CoinPack`** / **`Plan`** / **`Gift`**: gói coin / gói VIP / quà tặng tác giả.

## `demo_data.dart` — chi tiết
- `chaptersFor(b)` sinh **100 chương**: 1–10 `free`; chương 24 = `current`; bội số 25 = `vip`; còn lại = `coin`.
- `cover` trỏ asset (`assets/covers/*`); thiếu ảnh → `CoverImage` tự render placeholder gradient.
- `songs`/audiobook trỏ `assets/audio/*` (Tuấn Vũ demo).

## Khi sửa
- Thêm field model → cập nhật cả nơi tạo trong `Demo` + chỗ đọc trong `screens/`.
- Khi nối backend: **giữ các lớp này** làm model UI, viết mapper API→model trong lớp repository; `Demo` chuyển thành fixture cho test/preview. Xem [docs/07 §2](../../docs/07-noi-backend.md).
