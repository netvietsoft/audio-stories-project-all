# `lib/screens/novel/` — Chế độ Novel (đọc truyện)

Accent: **terracotta**. Dữ liệu từ `Demo.books` + `Demo.chaptersFor(book)`.

## Files
| File | Màn | Route | Điểm chính |
|---|---|---|---|
| `novel_home_screen.dart` | Home (tab) | `/home` tab 0 | Continue Reading, "For You" rail, Hot Ranking, New & Trending. Chứa **`TopBarShared`** (menu Novel/Audio + coin pill + nút theme) — **dùng chung cả Audio Home**. |
| `discover_screen.dart` | Discover (tab) | tab 1 | Ô search (tĩnh), chip lọc, rail "Best New", grid 3 cột. |
| `trending_screen.dart` | Trending (tab) | tab 2 | Chip thời gian (Today/Week/Month/All-time), bảng xếp hạng (màu rank #1/#2/#3). |
| `book_detail_screen.dart` | Chi tiết truyện | `/book/:id` | Bìa + stat (rating→`showRatingSheet`), CTA **Read Now** (`/reader`) + **Listen** (`playSong` demo → `/audiobook`), danh sách chương (badge theo `ChapterState` + khoá), comments. |
| `reader_screen.dart` | Đọc chương | `/reader/:id?ch=` | **File lớn nhất.** Chỉnh cỡ chữ/nền (light/sepia/dark)/màu chữ (8 màu); **read-along** (highlight từ + auto-scroll + Timer); panel khoá → `showUnlockSheet`; cuối chương Comment/Support/Share; Prev/Next. |

## Luồng tiêu biểu
`Home/Discover/Trending → context.push('/book/:id') → BookDetail → Read Now → /reader`.
Chương khoá (coin/vip & chưa unlock) → `showUnlockSheet` → mở khoá (`app.unlockChapter`) rồi mới vào Reader.

## State dùng
- `app.isUnlocked/unlockChapter` (mở khoá chương), `app.coins` (hiển thị + chi qua sheet),
  `app.mode/toggleTheme` (TopBarShared). Badge chương đọc `ChapterState` từ `Demo.chaptersFor`.

## Khi sửa
- Badge/khoá chương: đối chiếu `ChapterState` (`models.dart`). Khi nối backend, map sang
  `ChapterAccessType` + trạng thái unlock thật ([docs/07 §2](../../../docs/07-noi-backend.md)).
- `TopBarShared` ở file này được Audio Home import lại — đổi nó ảnh hưởng cả 2.
