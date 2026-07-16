# `lib/widgets/` — Component dùng chung

Chỉ chứa widget **tái dùng ≥2 màn**. Widget chỉ dùng 1 màn → để private (`_Widget`) trong file màn đó.
Tài liệu đầy đủ: [docs/05](../../docs/05-components-dung-chung.md).

## Files
| File | Vai trò |
|---|---|
| `cover_image.dart` | `CoverImage` — bìa truyện/nhạc; thiếu ảnh → **placeholder gradient + tên** (`errorBuilder`). Cache giải mã ảnh (`cacheWidth ~ DPR`, `gaplessPlayback`). `aspect` 3/4 (truyện) hoặc 1 (nhạc/album). |
| `sheets.dart` | 3 bottom-sheet dùng chung (helper `_showSheet` chuẩn hoá radius 22/handle/SafeArea): `showUnlockSheet` (mở khoá chương), `showGiftSheet` (tặng quà), `showRatingSheet` (đánh giá sao). |

## Ghi chú dùng
- `CoverImage(path, title, radius, aspect)` — dùng ở mọi nơi hiển thị bìa.
- Sheets đọc state qua `context.read<AppState>()`, đóng bằng `Navigator.pop(c, kq)`:
  - `showUnlockSheet` trả `Future<bool>` (mở khoá → `app.unlockChapter`).
  - `showGiftSheet` gửi gift Pulse thật qua BE (amount theo vật phẩm, kèm chapterId).
- Sheets hiện thao tác **cục bộ/demo** cho unlock/rating. Gift gọi API thật (`POST /stories/:id/gift`). Demo comment sheet đã xoá. Xem [docs/07 §3](../../docs/07-noi-backend.md).

## Khi thêm component
- Tách ra đây **chỉ khi** dùng từ 2 màn trở lên; đặt tên file `snake_case.dart`, 1 widget công khai/ file (helper sheet là ngoại lệ — gom theo nhóm chức năng).
- Luôn dùng token `context.pal`/`AppType`/`Gap`/`Radii`, không hardcode.
