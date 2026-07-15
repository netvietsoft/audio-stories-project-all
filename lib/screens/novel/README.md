# `lib/screens/novel/` — Chế độ Novel (đọc truyện)

Accent: **terracotta**. Dữ liệu từ `Demo.books` + `Demo.chaptersFor(book)`.

## Files
| File | Màn | Route | Điểm chính |
|---|---|---|---|
| `novel_home_screen.dart` | Home (tab) | `/home` tab 0 | Continue Reading, "For You" rail, Hot Ranking, New & Trending. Chứa **`TopBarShared`** (menu Novel/Audio + coin pill + nút theme) — **dùng chung cả Audio Home**. |
| `discover_screen.dart` | Discover (tab) | tab 1 | Ô search (tĩnh), chip lọc, rail "Best New", grid 3 cột. |
| `trending_screen.dart` | Trending (tab) | tab 2 | Chip thời gian (Today/Week/Month/All-time), bảng xếp hạng (màu rank #1/#2/#3). |
| `book_detail_screen.dart` | Chi tiết truyện | `/book/:id` | Bìa + stat (rating→`showRatingSheet`), CTA **Read Now** (`/reader`) + **Listen** (`playSong` demo → `/audiobook`), danh sách chương (badge theo `ChapterState` + khoá), comments. |
| `reader_screen.dart` | Đọc chương | `/reader/:id?ch=` | **File lớn nhất.** Chỉnh cỡ chữ (slider 14–30)/giãn dòng (slider 1.4–3.0)/nền (4 preset + custom color picker)/màu chữ (Đen mặc định + 8 màu + custom picker, không còn Auto); **read-along** (highlight câu + auto-scroll theo `timing` của chương); panel khoá → `showUnlockSheet`; cuối chương Comment/Support/Share; Prev/Next. |

## Read-along (highlight câu theo audio)
- State: `_readAlong` (bật/tắt, load từ `_reader.readReadAlong()`), `_cues` (`List<TimingCue>` lấy từ
  `ChapterContent.cues` khi `_loadContent`), `_activeCue` (`ValueNotifier<int>`, dispose ở `dispose()`),
  `_paraKeys` (Map<int, GlobalKey> — key từng đoạn để auto-scroll), `_playingThis` (audio đang phát có
  đúng là của chương đang hiển thị không).
- `bool get _readAlongActive => _readAlong && _cues.isNotEmpty && _playingThis` — 3 điều kiện phải đủ cả.
  `_playingThis` xác định bằng so khớp CHÍNH XÁC `app.nowPlayingTitle == _audioTitle(book, ch)`; helper
  `_audioTitle(book, ch) => '${book.title} • Ch.${ch.n}'` dùng chung ở cả `_playChapterAudio` (lúc `app.play`)
  và `build` (lúc so khớp) nên không lệch nhau — tránh kẹt highlight sau khi dừng nhạc hoặc highlight nhầm chương.
- Một `ValueListenableBuilder<Duration>` nghe `app.position` (chỉ dựng khi `playingThis`) gọi `_syncActiveCue`;
  hàm này KHÔNG set state trực tiếp mà đẩy việc gán `_activeCue.value` + gọi `_scrollToPara` vào
  `WidgetsBinding.instance.addPostFrameCallback` (có check `mounted`) để tránh crash "gọi setState khi đang build".
- `_paragraph(...)` dựng bằng `Text.rich`, tô nền đoạn `[cs, ce)` của đoạn văn có `paraIndex` trùng cue đang
  active (màu `AppPalette.terracotta` alpha ~0.25 + `FontWeight.w600`); cs/ce được clamp theo độ dài text;
  cue `paraIndex < 0` (không khớp được) hoặc không active → render `Text` thường.
- `_scrollToPara` = `Scrollable.ensureVisible(alignment: 0.3, 300ms, easeOut)` theo GlobalKey của đoạn.
- Toggle **READ-ALONG** nằm trong sheet cài đặt đọc (nút Aa), sau mục brightness; đổi là lưu ngay qua
  `_reader.saveReadAlong(v)`.
- Icon tai nghe ("Nghe") trên top bar chỉ hiện khi **cả truyện** có ít nhất 1 chương có audio
  (`chapters.any((c) => c.hasAudio)`), không phải riêng chương hiện tại.
- Không có `timing` (chương chưa gắn phụ đề) → `_cues` rỗng → bật toggle cũng không highlight gì.

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
