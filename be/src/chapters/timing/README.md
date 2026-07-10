# Timing (read-along) — `be/src/chapters/timing/`

> Đọc CODE THẬT — cập nhật theo source ngày 2026-07-08. "Tin code hơn doc": mọi khác biệt
> giữa doc này và `*.ts` trong thư mục thì code thắng.

## Mục đích

Module này phục vụ tính năng **"đọc theo giọng đọc" (read-along)**: admin nạp file phụ đề/lyric
(SRT/VTT/LRC) kèm audio của chương → backend **parse** file đó thành các cue thô (mốc thời gian
+ text), **khớp** từng cue vào vị trí ký tự trong `Chapter.content`, rồi gộp thành JSON lưu vào
`Chapter.timingJson`. App đọc field này (`timing` ở `GET /chapters/:id/public`) để highlight câu
đang đọc + tự cuộn theo audio.

Toàn bộ xử lý chạy **đồng bộ trong request** (`create`/`update` chapter) — **không có worker/queue**
(khác pipeline HLS của audio). Input nhỏ (1 file phụ đề) nên không cần job nền.

## 3 file trong module

### `timing-parser.ts` — parse file thô → cue thô

```ts
export interface RawCue { startMs: number; endMs: number; text: string }
export type TimingFormat = 'srt' | 'vtt' | 'lrc' | 'auto';
function parseTiming(raw: string, format: TimingFormat, audioDurationSec?: number): RawCue[]
```

- Trả `[]` (không throw) khi `raw` rỗng hoặc không parse được cue nào — file rác không làm hỏng request.
- Kết quả luôn được sort theo `startMs`.
- `format: 'auto'` tự nhận diện: dòng đầu bắt đầu `WEBVTT` → vtt; bắt đầu `[mm:ss` → lrc; còn lại → srt.

**SRT & VTT** dùng chung 1 regex timeline `HH:MM:SS[.,]mmm --> HH:MM:SS[.,]mmm` (chấp nhận cả `,`
lẫn `.` làm dấu phân cách mili-giây). Block phụ đề tách nhau bởi dòng trống (`\n\s*\n`); text của
cue = các dòng còn lại trong block sau dòng timeline, nối bằng khoảng trắng. Header `WEBVTT`, số
thứ tự cue, cue-id/settings của VTT đều bị bỏ qua (không match regex timeline nên không lẫn vào text).

**LRC** dùng cú pháp `[mm:ss.xx] text` (chỉ có mốc bắt đầu). Với mỗi dòng: `endMs` = `startMs` của
dòng **kế tiếp**. Riêng dòng **cuối cùng**: `endMs = audioDurationSec * 1000` **chỉ khi** giá trị đó
lớn hơn `startMs` của chính nó; ngược lại (thiếu `audioDurationSec`, hoặc giá trị đó bị stale/làm
tròn nhỏ hơn mốc bắt đầu) thì `endMs = startMs + 3000` — tránh sinh ra một cue cuối có `endMs <= startMs`.

### `timing-matcher.ts` — khớp cue vào offset ký tự trong `content`

```ts
export interface MappedCue { s: number; e: number; p: number; cs: number; ce: number }
export interface ChapterTiming { v: 1; cues: MappedCue[]; matched: number; total: number }
function matchCues(content: string, cues: RawCue[]): ChapterTiming
```

- `content` được chia đoạn văn theo cùng quy tắc app dùng để render (`\n\s*\n`), giữ lại offset ký
  tự gốc (`start`) của từng đoạn sau khi trim.
- **Chuẩn hoá đối xứng** (áp dụng cho cả `content` lẫn text của mỗi cue): lowercase + coi **bất kỳ
  ký tự không phải chữ/số** (`[^\p{L}\p{N}]`, Unicode-aware nên dấu tiếng Việt vẫn được tính là chữ)
  là **dấu phân cách mềm**, gộp các dấu liên tiếp thành một khoảng trắng. Đây là cơ chế **dung sai
  dấu câu**: cue `"Anh yêu em cô nói"` vẫn khớp được với content `"Anh yêu em," cô nói.` dù khác
  nhau dấu phẩy/chấm/ngoặc kép.
- `normalizeWithMap` khi chuẩn hoá `content` còn giữ `map[chỉ_số_trong_chuỗi_chuẩn_hoá] → chỉ_số_gốc`,
  nên `cs`/`ce` trả về **luôn trỏ vào chuỗi `content` GỐC** (còn nguyên dấu câu) — app highlight đúng
  ký tự thật đang hiển thị, không phải chuỗi đã chuẩn hoá.
- Khớp bằng **một con trỏ (`cursor`) chạy tới, không bao giờ lùi lại**: mỗi cue được tìm bằng
  `norm.indexOf(nt, cursor)` rồi đẩy `cursor` tới hết cue đó. Nhờ vậy các cue cùng nội dung lặp lại
  trong `content` vẫn được khớp tuần tự đúng thứ tự thời gian.
- Cue không tìm thấy trong `content` (hoặc text rỗng sau chuẩn hoá) → `p = -1` (vẫn giữ nguyên `s`/`e`).
- **Cue vắt qua ranh giới đoạn văn bị TỪ CHỐI** (`p = -1`, không tăng `matched`) thay vì bị cắt gọn
  vào đoạn đầu tiên một cách âm thầm — tránh hiển thị sai vị trí.
- Trả thêm `matched` (số cue khớp được) / `total` (tổng số cue) — chỉ để admin xem, app không dùng.

### `build-timing.ts` — gộp 2 bước, tạo JSON để lưu

```ts
function buildTimingJson(
  content: string | null | undefined,
  timingRaw: string | null | undefined,
  timingFormat: TimingFormat | undefined,
  audioDurationSec?: number,
): ChapterTiming | null
```

Gọi `parseTiming` rồi `matchCues`. Trả về `null` (không lưu gì) khi:
- không có `timingRaw` (rỗng/undefined/chỉ toàn khoảng trắng), hoặc
- không có `content`, hoặc
- `parseTiming` ra 0 cue (file rác/không đúng định dạng).

## Hình dạng JSON lưu trong `Chapter.timingJson`

```json
{
  "v": 1,
  "cues": [
    { "s": 1000, "e": 3500, "p": 0, "cs": 0, "ce": 11 }
  ],
  "matched": 1,
  "total": 1
}
```

- `s`/`e`: mốc thời gian bắt đầu/kết thúc của cue (ms, từ file phụ đề/lyric gốc).
- `p`: index đoạn văn trong `content` mà cue này thuộc về; `-1` nếu không khớp được.
- `cs`/`ce`: offset ký tự bắt đầu/kết thúc (nửa khoảng `[cs, ce)`) của cue **trong đoạn văn `p`**,
  trỏ vào text gốc (còn dấu câu).
- `matched`/`total`: chỉ phục vụ admin xem tỉ lệ khớp; **app KHÔNG đọc 2 field này**.

Field/key trên phải giữ nguyên tên (`v`, `cues`, `matched`, `total`, và trong mỗi cue: `s`, `e`,
`p`, `cs`, `ce`) — app Flutter (`TimingCue.fromMap`) đọc đúng các key này, đổi tên là vỡ hợp đồng
ngầm giữa 2 phía.

## Edge case

- File timing rỗng/garbage → `parseTiming` trả `[]` → `buildTimingJson` trả `null` → không ghi gì
  vào `timingJson`, chương vẫn lưu bình thường.
- Cue không khớp được nội dung → `p = -1`, vẫn giữ `s`/`e` trong mảng `cues` (không bị loại bỏ).
- Cue vắt qua 2 đoạn văn → bị từ chối (`p = -1`), không tính vào `matched`.
- `content` bị sửa sau khi đã import timing → offset có thể lệch so với văn bản mới; cần nạp lại
  file timing (re-import) để tính lại `matchCues`.
- LRC thiếu `audioDurationSec` hoặc giá trị đó nhỏ hơn/bằng mốc bắt đầu của dòng cuối → dòng cuối
  tự lấy `endMs = startMs + 3000` thay vì sinh ra khoảng thời gian âm/bằng 0.

## Ai dùng module này

- `be/src/chapters/chapters.service.ts`: gọi `buildTimingJson(...)` trong `create`,
  `createStandalone`, và cả 2 nhánh của `update` (update thường + nhánh đổi `storyId`); kết quả gán
  vào field `timingJson` trước khi ghi Prisma. `findPublicDetail` select thêm `timingJson` và trả về
  `timing: chapter.timingJson ?? null` cho `GET /chapters/:id/public`.
- `be/src/chapters/dto/create-chapter.dto.ts` + `update-chapter.dto.ts`: nhận input thô từ admin
  qua 2 field `timingRaw?: string` và `timingFormat?: 'srt'|'vtt'|'lrc'|'auto'`; 2 field này bị xoá
  khỏi payload ghi Prisma (không phải cột DB thật, chỉ để service tính `timingJson`).
- `be/prisma/schema.prisma`: cột lưu là `Chapter.timingJson Json? @map("timing_json")` (nullable —
  chương cũ không có timing vẫn chạy bình thường).
- Phía app (Flutter, `novelverse`): `lib/data/repositories/stories_repository.dart` có
  `TimingCue.fromMap` đọc đúng key `s/e/p/cs/ce` (`p` mặc định `-1` nếu thiếu/không phải số), gắn
  vào `ChapterContent.cues`; `lib/screens/novel/reader_screen.dart` dùng cues này để highlight đoạn
  đang đọc + tự cuộn khi audio của đúng chương đang phát.

## Chạy test

```bash
cd be
node node_modules/jest/bin/jest.js src/chapters/timing
```

3 file spec (`timing-parser.spec.ts`, `timing-matcher.spec.ts`, `build-timing.spec.ts`) — 13 test,
tất cả pass.

---
Cập nhật: 2026-07-08
