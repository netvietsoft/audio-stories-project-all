# 08 — Read-along (tô sáng câu theo audio)

> Feature "read-along": admin nạp file timing (SRT/VTT/LRC) kèm audio một chương; backend
> parse + khớp từng câu vào vị trí ký tự trong `content`, lưu `Chapter.timingJson`, trả qua
> `GET /chapters/:id/public` field `timing`; app Flutter tô sáng câu đang đọc + tự cuộn theo
> vị trí audio đang phát. Quy ước: **tin code hơn doc** — mọi khẳng định dưới đây đã đối
> chiếu trực tiếp với code (BE `be/src/chapters/timing/*.ts` + `chapters.service.ts`, APP
> `lib/data/repositories/stories_repository.dart`, `lib/screens/novel/reader_screen.dart`,
> `lib/data/reader/reader_store.dart`). Spec/plan gốc: `docs/superpowers/specs/2026-07-08-reader-readalong-import-design.md`,
> `docs/superpowers/plans/2026-07-08-reader-readalong-import.md`. Cập nhật: 2026-07-08.

═══════════════════════════════════════════════════════════════════════
## 1. MỤC TIÊU & LUỒNG END-TO-END
═══════════════════════════════════════════════════════════════════════

Mục tiêu: admin không phải tự tay đánh dấu từng câu — chỉ cần xuất 1 file timing (từ Whisper,
CapCut, phần mềm phụ đề…) rồi upload cùng audio; backend tự khớp câu vào đúng đoạn văn/ký tự
của `content`; app đọc kết quả và tô sáng theo thời gian thực, không cần xử lý gì thêm.

```
ADMIN (ChapterForm.tsx): chọn audio + chọn file .srt/.vtt/.lrc
  → handleTimingFileSelect đọc file.text(), đoán format theo ĐUÔI file (.vtt→vtt, .lrc→lrc,
    .srt→srt, đuôi khác→'auto' để BE tự detect theo NỘI DUNG) → set timingRaw + timingFormat vào payload
  → submit cùng create/update chapter (KHÔNG phải request riêng)

BACKEND (đồng bộ trong request, KHÔNG qua worker/queue — khác pipeline HLS):
  buildTimingJson(content, timingRaw, timingFormat, audioDurationSec)
    1. parseTiming(timingRaw, timingFormat, audioDurationSec) → RawCue[] {startMs, endMs, text}
    2. matchCues(content, cues) → ChapterTiming { v:1, cues:[{s,e,p,cs,ce}], matched, total }
  → lưu Chapter.timingJson (cột JSON nullable, chương cũ không có timing vẫn chạy bình thường)
  → GET /chapters/:id/public trả thêm field `timing` = timingJson hoặc null

APP (reader_screen.dart):
  chapterContent(id) → ChapterContent.cues: List<TimingCue>  (rỗng nếu chương chưa có timing
                                                               HOẶC đang đọc offline/local-first)
  ĐIỀU KIỆN tô sáng (đủ CẢ 3): readAlong bật (Switch trong sheet Aa)
                              AND cues không rỗng
                              AND audio ĐANG PHÁT ĐÚNG chương đang mở
  khi đủ 3 điều kiện: nghe app.position (ms) → activeCueIndex(cues, pos) → tô [cs,ce) trong
  đoạn văn paraIndex (Text.rich) + Scrollable.ensureVisible tới đoạn đó
```

Điểm khác biệt lớn nhất so với pipeline audio/HLS (`../backend/docs/09-audio-pipeline.md`):
read-along xử lý **đồng bộ ngay trong request** tạo/sửa chương (không BullMQ, không polling
status) — vì parse+match text chạy đủ nhanh, không cần tách worker.

═══════════════════════════════════════════════════════════════════════
## 2. BACKEND — parse, match, lưu, trả
═══════════════════════════════════════════════════════════════════════

### 2.1. Parse file timing — `be/src/chapters/timing/timing-parser.ts`

`parseTiming(raw: string, format: 'srt'|'vtt'|'lrc'|'auto', audioDurationSec?: number): RawCue[]`,
`interface RawCue { startMs: number; endMs: number; text: string }`.

- **SRT & VTT dùng chung 1 regex** `HH:MM:SS[.,]mmm --> HH:MM:SS[.,]mmm`; tách block theo dòng
  trống (`\n\s*\n`); text = các dòng sau timeline trong block, nối bằng khoảng trắng. Header
  `WEBVTT`, id cue, settings dòng timeline của VTT không ảnh hưởng (chỉ cần dòng đó khớp regex).
- **LRC** `[mm:ss.xx] text`; `endMs` của mỗi dòng = `startMs` của dòng kế; dòng CUỐI: lấy
  `audioDurationSec*1000` **chỉ khi** giá trị đó lớn hơn `startMs` của chính nó, ngược lại
  `startMs + 3000` (phòng `audioDurationSec` cũ/làm tròn sai khiến end < start).
- **`format:'auto'`** detect theo đầu nội dung: có `WEBVTT` → vtt; bắt đầu `[mm:ss` → lrc;
  còn lại → srt.
- Input rỗng/không parse được → trả `[]` (không throw). Kết quả sort theo `startMs`.

### 2.2. Khớp câu vào content — `be/src/chapters/timing/timing-matcher.ts`

`matchCues(content: string, cues: RawCue[]): ChapterTiming`,
`interface MappedCue { s:number; e:number; p:number; cs:number; ce:number }`,
`interface ChapterTiming { v:1; cues: MappedCue[]; matched: number; total: number }`.

- Tách `content` thành đoạn văn theo `\n\s*\n` (giữ offset ký tự gốc của từng đoạn).
- **Chuẩn hoá dung sai dấu câu**: cả `content` lẫn text của từng cue đều được chuẩn hoá
  ĐỐI XỨNG — lowercase, coi mọi ký tự KHÔNG PHẢI chữ/số (`[^\p{L}\p{N}]`, Unicode-aware nên
  dấu tiếng Việt vẫn được giữ là chữ) là dấu phân cách mềm, gộp liên tiếp thành 1 khoảng
  trắng. Nhờ vậy cue `"Anh yêu em cô nói"` khớp được content `"Anh yêu em," cô nói.`.
  `normalizeWithMap` giữ `map[normIndex] → originalContentIndex` để `cs`/`ce` trỏ đúng vào
  ký tự GỐC (có dấu câu) trong đoạn — app tô sáng đúng ký tự thật, không lệch.
- Khớp bằng **1 con trỏ tiến duy nhất, không bao giờ lùi** (`cursor`); mỗi cue được tìm từ
  vị trí `cursor` trở đi trong chuỗi đã chuẩn hoá.
- Cue không khớp được → `p = -1` (vẫn giữ `s`/`e`). Cue khớp nhưng **vắt qua ranh giới 2 đoạn
  văn** (`origEnd > pEnd` của đoạn chứa điểm bắt đầu) bị **TỪ CHỐI** — trả `p=-1`, KHÔNG tính
  vào `matched` — thay vì cắt cụt về đoạn đầu một cách âm thầm.
- `matched`/`total` chỉ để admin xem tỉ lệ khớp (app không dùng).

### 2.3. Gộp 2 bước — `be/src/chapters/timing/build-timing.ts`

`buildTimingJson(content, timingRaw, timingFormat, audioDurationSec): ChapterTiming | null`
— trả `null` khi thiếu `timingRaw`, thiếu `content`, hoặc parse ra 0 cue.

### 2.4. DTO & wiring service

`create-chapter.dto.ts` / `update-chapter.dto.ts` đều có:
```
timingRaw?: string        // @IsString @MaxLength(2000000)
timingFormat?: 'srt' | 'vtt' | 'lrc' | 'auto'   // @IsEnum
```
`chapters.service.ts`: `buildTimingJson(...)` được gọi trong `create`, `createStandalone`,
và CẢ 2 nhánh của `update` (update thường + update kèm đổi `storyId`); `audioDuration` coerce
`?? undefined` (ưu tiên giá trị mới, fallback `chapter.audioDuration` cũ khi update không gửi
lại). `timingRaw`/`timingFormat` bị **xoá khỏi payload ghi Prisma** (`delete ...timingRaw` /
`delete ...timingFormat`) — không phải cột DB thật, chỉ dùng để service tự tính `timingJson`
rồi ghi field đó. `findPublicDetail` select thêm `timingJson`, trả `timing: chapter.timingJson ?? null`.

### 2.5. Lưu trữ & migration

`be/prisma/schema.prisma` model `Chapter`: `timingJson Json? @map("timing_json")` (nullable —
chương cũ không timing vẫn chạy bình thường). Migration
`be/prisma/migrations/20260708000000_add_chapter_timing_json/migration.sql`:
```sql
ALTER TABLE `chapters` ADD COLUMN `timing_json` JSON NULL;
```

> ⚠ **Cần làm trước khi deploy prod**: `.gitignore` chặn `*.sql` ở root repo, nên file
> `migration.sql` này KHÔNG được git-track/push. Prod phải tự thêm cột `timing_json` (chạy
> `prisma migrate deploy` với migration nằm sẵn, hoặc `ALTER TABLE` thủ công như trên) TRƯỚC
> khi tính năng read-along hoạt động ở đó — thiếu bước này thì `timing` luôn trả `null` (hoặc
> lỗi ghi tuỳ cấu hình Prisma) dù code đã deploy đủ.

### 2.6. Admin — `fe/apps/admin/.../chapters/_components/ChapterForm.tsx`

Input file `accept=".srt,.vtt,.lrc"` cạnh input audio. `handleTimingFileSelect`: đọc
`file.text()`, đoán format theo đuôi file (`.vtt`→`vtt`, `.lrc`→`lrc`, `.srt`→`srt`, đuôi khác→`'auto'`
để BE tự detect theo nội dung), set `timingRaw`/`timingFormat` vào form, gộp chung
vào payload create/update chapter (không phải API riêng). Admin thấy dòng xác nhận "Đã nạp
file timing (`<FORMAT>`)" — với `<FORMAT>` là định dạng đã chọn (SRT/VTT/LRC/AUTO) — sau khi chọn;
**chưa** hiển thị lại `matched/total` mà BE trả về (xem §6 — DEFERRED).

### 2.7. Test

`be/src/chapters/timing/{timing-parser,timing-matcher,build-timing}.spec.ts` — chạy bằng
`node node_modules/jest/bin/jest.js src/chapters/timing` (từ `be/`).

═══════════════════════════════════════════════════════════════════════
## 3. HỢP ĐỒNG JSON (backend ↔ app) — ĐÃ ĐỐI CHIẾU KHỚP
═══════════════════════════════════════════════════════════════════════

`Chapter.timingJson` (BE) và field `timing` trong `GET /chapters/:id/public` là **cùng 1
object**. App đọc trực tiếp object này ở `stories_repository.dart` (`TimingCue.fromMap`).

| Key BE (`MappedCue`) | Field app (`TimingCue`) | Ý nghĩa |
|---|---|---|
| `s` | `startMs` | Mốc bắt đầu câu (ms) |
| `e` | `endMs` | Mốc kết thúc câu (ms) |
| `p` | `paraIndex` | Index đoạn văn trong `content` (tách theo `\n\s*\n`); `-1` = không khớp được đoạn nào |
| `cs` | `charStart` | Vị trí ký tự BẮT ĐẦU trong đoạn `p` (trên text GỐC, có dấu câu) |
| `ce` | `charEnd` | Vị trí ký tự KẾT THÚC (exclusive) trong đoạn `p` |

Top-level: `{ v: 1, cues: MappedCue[], matched: number, total: number }`. `v`/`matched`/`total`
chỉ dùng ở BE/admin — app **bỏ qua**, chỉ đọc `cues`.

`TimingCue.fromMap` (`lib/data/repositories/stories_repository.dart`) đọc đúng 5 khoá
`m['s'], m['e'], m['p'], m['cs'], m['ce']`; `paraIndex` mặc định `-1` nếu `p` thiếu hoặc không
phải số. → **Một sai lệch tên khoá ở đây là lỗi câm ở production** (app không crash, chỉ đơn
giản không tô sáng gì) — đã kiểm tra khớp 100% giữa `timing-matcher.ts` và `stories_repository.dart`
tại thời điểm viết doc này.

Xem thêm mô tả field `timing` phía BE: `../backend/docs/10-mobile-api.md`
(mục API `/chapters/:id/public`), `../backend/docs/08-api-list.md`,
`../backend/docs/04-database.md` (cột `timing_json`).

═══════════════════════════════════════════════════════════════════════
## 4. APP (Flutter) — nhận dữ liệu, tô sáng, tự cuộn
═══════════════════════════════════════════════════════════════════════

### 4.1. Model & repository — `lib/data/repositories/stories_repository.dart`

```dart
class TimingCue {
  final int startMs, endMs, paraIndex, charStart, charEnd;
  factory TimingCue.fromMap(Map m) { ... } // đọc s/e/p/cs/ce, p mặc định -1
}

int? activeCueIndex(List<TimingCue> cues, int posMs)
  // → index cue có startMs <= posMs < endMs, hoặc null; giả định cues đã sort theo startMs
```

`ChapterContent` có thêm `final List<TimingCue> cues` (mặc định `const []`). Trong
`chapterContent(id)`: `cues` chỉ được parse từ `m['timing']['cues']` ở **nhánh online**
(gọi `GET /chapters/:id/public`); nhánh **local-first/offline** (đọc `OfflineChapter` đã
download) trả `ChapterContent` KHÔNG có `cues` → mặc định rỗng — read-along hiện **chưa hoạt
động khi đọc offline** (xem §6).

### 4.2. Persist bật/tắt — `lib/data/reader/reader_store.dart`

`bool readReadAlong()` (mặc định `false`) + `Future<void> saveReadAlong(bool)`, lưu
`SharedPreferences` key `reader.readalong` — cùng pattern với pref `reader.brightness` đã có.

### 4.3. Wiring trong `lib/screens/novel/reader_screen.dart`

State liên quan: `_readAlong` (nạp từ `readReadAlong()` trong `initState`), `_cues` (nạp từ
`ChapterContent.cues` trong `_loadContent`), `_activeCue` — `ValueNotifier<int>` (dispose
trong `dispose`), `_paraKeys` — `Map<int, GlobalKey>` theo index đoạn văn, `_playingThis`.

**3 điều kiện kích hoạt (đủ cả 3 mới tô sáng)**:
```dart
bool get _readAlongActive => _readAlong && _cues.isNotEmpty && _playingThis;
```

**Chốt chặn đúng-chương** (fix lỗi "kẹt tô sáng sau khi dừng nhạc" / "tô sáng nhầm chương"):
`playingThis` được set vào `_playingThis` trong `build()`, tính bằng so khớp CHÍNH XÁC
`app.nowPlayingTitle == _audioTitle(book, currentChapter)`. Helper dùng chung
`_audioTitle(book, ch) => '${book.title} • Ch.${ch.n}'` được gọi bởi **cả** `_playChapterAudio`
(lúc phát) **lẫn** `build` (lúc kiểm tra) — tiêu đề lúc phát và điều kiện kiểm tra không bao
giờ lệch nhau, nên read-along chỉ active đúng khi audio ĐANG PHÁT của ĐÚNG chương đang mở.

**Đồng bộ theo vị trí phát** — một `ValueListenableBuilder<Duration>` lắng nghe `app.position`
(chỉ được build khi `playingThis`) gọi `_syncActiveCue(app)`. Hàm này tính
`activeCueIndex(_cues, posMs)` rồi **DEFER** việc gán `_activeCue.value = idx` và gọi
`_scrollToPara(...)` vào trong `WidgetsBinding.instance.addPostFrameCallback` (có check
`mounted`) — KHÔNG BAO GIỜ mutate/scroll ngay trong lúc đang build, để tránh crash kiểu
"setState/markNeedsBuild trong lúc build".

**Tô sáng** — `_paragraph(...)` dựng `Text.rich` cho đoạn văn có `paraIndex == active cue's
paraIndex`: 3 `TextSpan` (trước `cs`, đoạn `[cs, ce)` tô nền `AppPalette.terracotta` alpha
~0.25 + `FontWeight.w600`, sau `ce`); `cs`/`ce` được `clamp` vào độ dài text đoạn đó (chống
lệch offset nếu `content` bị sửa sau khi import timing). Không active hoặc `paraIndex == -1`
→ render `Text` thường (không rich).

**Tự cuộn** — `_scrollToPara(i)` dùng `Scrollable.ensureVisible(ctx, alignment: 0.3, duration:
300ms, curve: Curves.easeOut)` trên `GlobalKey` của đoạn văn `i` (lấy/khởi tạo qua `_paraKeys`).

**Toggle UI** — Switch (`activeThumbColor: AppPalette.terracotta`) trong sheet cài đặt đọc
"Aa", đặt ngay sau slider BRIGHTNESS, nhãn "Tô sáng câu theo audio"; `onChanged` cập nhật
state cục bộ NGAY và gọi `_reader.saveReadAlong(v)` để persist ngay lập tức.

**Gate cấp truyện** — icon tai nghe ("Nghe") trên top bar chỉ hiện khi
`chapters.any((c) => c.hasAudio)` — tức là gate theo TOÀN TRUYỆN có ít nhất 1 chương có audio,
không phải riêng chương đang mở.

**Đổi chương** — `_goChapter` reset `_activeCue.value = -1` và `_paraKeys.clear()` để không
giữ trạng thái tô sáng/cuộn của chương cũ.

### 4.4. Test & build

`flutter test` — 30 test pass; `flutter analyze` — 0 lỗi/0 cảnh báo (chỉ còn info
`unnecessary_underscores` có sẵn từ trước trong repo, không liên quan read-along). Build máy
thật: `flutter build apk --release --dart-define=USE_BACKEND=true --dart-define=API_BASE_URL=<baseUrl>`
(xem `lib/api/api_env.dart` cho thứ tự ưu tiên `API_BASE_URL`/`USE_BACKEND`/`API_ENV`).

═══════════════════════════════════════════════════════════════════════
## 5. EDGE CASE
═══════════════════════════════════════════════════════════════════════

| Tình huống | Hành vi |
|---|---|
| Chương chưa có timing | `cues` rỗng → toggle có thể bật nhưng read-along không làm gì (không tô sáng) |
| Cue không khớp được (`p = -1`) | Không tô sáng, không tự cuộn cho cue đó |
| File timing lỗi/rác | `parseTiming` trả `[]`, KHÔNG lưu gì bậy vào `timingJson` (`buildTimingJson` trả `null`); `matched`/`total` để admin tự đánh giá |
| Sửa `content` chương sau khi đã import timing | Offset có thể lệch (`p`/`cs`/`ce` trỏ sai chỗ) → cần re-import; app `clamp` `cs`/`ce` nên không crash, chỉ tô sai vị trí |
| Chương bị khoá (chưa unlock) | Không phát audio → `playingThis` false → không active |
| Đọc offline (đã tải chương) | `cues` luôn rỗng ở nhánh local-first hiện tại → read-along không hoạt động khi offline |

═══════════════════════════════════════════════════════════════════════
## 6. DEFERRED / CHƯA LÀM Ở v1
═══════════════════════════════════════════════════════════════════════

- `ChapterVariant.timingJson` (timing cho nhánh rẽ truyện tương tác) — có trong spec ban đầu,
  **quyết định hoãn** (2026-07-08).
- Read-along OFFLINE — chưa persist `cues` vào `OfflineChapter`; theo sau khi có nhu cầu.
- Read-along trên WEB (`StoryReader.tsx`, `fe/apps/web`) — ngoài phạm vi v1.
- Tô sáng theo TỪ (word-level) — v1 chỉ tô theo câu/dòng, đúng đơn vị của file timing.
- Admin hiển thị lại `matched`/`total` sau khi lưu — BE đã trả field này, form admin chưa hiện.
- Biết trước: auto-scroll của read-along có thể trùng thời điểm với `jumpTo` resume/bookmark
  (Spec 1) khi mở lại chương lúc audio đang phát sẵn (cold-open); `_activeCue` là 1
  `ValueNotifier` dùng chung nên mỗi tick cue rebuild lại toàn bộ builder đoạn văn (rẻ, không
  vấn đề hiệu năng ở quy mô hiện tại, nhưng là điểm cần biết nếu chương rất dài).

═══════════════════════════════════════════════════════════════════════
## 7. THAM CHIẾU NHANH
═══════════════════════════════════════════════════════════════════════

| Việc | File |
|---|---|
| Parse SRT/VTT/LRC | `be/src/chapters/timing/timing-parser.ts` |
| Khớp cue vào content (dung sai dấu câu, chống vắt đoạn) | `be/src/chapters/timing/timing-matcher.ts` |
| Gộp parse+match | `be/src/chapters/timing/build-timing.ts` |
| DTO nhận `timingRaw`/`timingFormat` | `be/src/chapters/dto/create-chapter.dto.ts`, `update-chapter.dto.ts` |
| Wiring service + serve `timing` | `be/src/chapters/chapters.service.ts` |
| Cột DB + migration | `be/prisma/schema.prisma` (`Chapter.timingJson`), `be/prisma/migrations/20260708000000_add_chapter_timing_json/` |
| Admin upload file timing | `fe/apps/admin/src/app/[lang]/stories/[id]/chapters/_components/ChapterForm.tsx` |
| Model + fetch cues (app) | `lib/data/repositories/stories_repository.dart` (`TimingCue`, `activeCueIndex`, `ChapterContent.cues`) |
| Persist bật/tắt (app) | `lib/data/reader/reader_store.dart` (`readReadAlong`/`saveReadAlong`) |
| Tô sáng + tự cuộn + toggle (app) | `lib/screens/novel/reader_screen.dart` |
| Mô tả API/DB phía BE (bản đầy đủ hơn) | `../backend/docs/02-be-stories-chapters.md` §Read-along, `../backend/docs/08-api-list.md`, `../backend/docs/10-mobile-api.md`, `../backend/docs/04-database.md` |
| Spec & plan gốc | `docs/superpowers/specs/2026-07-08-reader-readalong-import-design.md`, `docs/superpowers/plans/2026-07-08-reader-readalong-import.md` |
