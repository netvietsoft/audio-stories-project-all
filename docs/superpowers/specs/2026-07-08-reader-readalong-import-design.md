# Reader Read-along (import timing) — Spec 2 — Design

> Ngày: 2026-07-08 · App: NovelVerse Flutter + Backend (NestJS/Prisma) + Admin (Next.js) · Trạng thái: design đã duyệt, chờ review → plan.
> Loạt "Reader sâu hơn". Spec 1 (đọc liền mạch + polish) đã xong. **Spec 3** (comment/support/share đồng bộ web) tách riêng, chưa làm.

## 1. Mục tiêu
Khi nghe audiobook, Reader **tô sáng câu đang đọc + auto-scroll** theo vị trí audio (read-along), có **toggle bật/tắt**. Không dùng forced-alignment/ML: **import file timing có sẵn** (SRT/VTT/LRC) do admin upload **cùng audio**; BE parse + ánh xạ vào `content` + serve; app tô sáng tại chỗ.

Kèm 1 bổ sung top-bar Reader: **icon tai nghe chỉ hiện khi truyện có audio** (bất kỳ chương nào có audio); truyện không audio → ẩn.

## 2. Phạm vi
**Trong:**
- BE: nhận `timingRaw`+`timingFormat` trong DTO tạo/sửa chương → parse (SRT/VTT/LRC) → match vào `content` → lưu `Chapter.timingJson`; serve trong `/chapters/:id/public`. Báo `matched/total` cho admin. (`ChapterVariant.timingJson` **hoãn** — xem "Ngoài phạm vi".)
- Admin (Next.js web admin): ô chọn file timing cạnh ô audio trong form chương.
- App: fetch cues; toggle read-along (persist ReaderStore); tô sáng câu active tại chỗ + auto-scroll; icon tai nghe top-bar theo mức truyện.

**Ngoài (follow-up/không làm):**
- Forced-alignment/ML sinh timing (đã loại).
- Read-along **offline** (chương đã tải chưa lưu cues) — follow-up nhỏ.
- Read-along trên **web** (StoryReader.tsx) — ngoài phạm vi.
- Highlight mức **từ** (chỉ mức **câu/dòng** theo cue của file).
- **`ChapterVariant.timingJson` (timing cho nhánh interactive) — HOÃN sang follow-up** (quyết định 2026-07-08). v1 chỉ làm mức `Chapter` (use-case chính). Khi làm variant: mirror y hệt đường Chapter (schema+migration cột `chapter_variants.timing_json`, timingRaw/timingFormat vào variant DTO, wiring `buildTimingJson` trong `chapter-variants.service`, thêm `timing` vào select/serve variant của `findPublicDetail`).

## 3. Kiến trúc & luồng
```
ADMIN: upload file timing (SRT/VTT/LRC) KÈM audio trong form chương
   │ (timingRaw + timingFormat trong payload create/update chương)
   ▼ BE (đồng bộ, KHÔNG worker)
 parse → cues[{startMs,endMs,text}] → MATCH tuần tự vào `content`
   │   (chia đoạn \n\s*\n; con trỏ chạy dọc; chuẩn hoá whitespace; dung sai dấu câu)
   ▼
 lưu Chapter.timingJson = { v:1, cues:[{s,e,p,cs,ce}], matched, total }   (p=paraIndex, cs/ce=offset trong đoạn)
   ▼ GET /chapters/:id/public  → thêm field `timing`
   ▼ APP Reader
 nếu (toggle ON) và (có cues) và (đang phát audio chương này):
    position(ms) → cue active (s≤pos<e) → render đoạn p bằng Text.rich, tô [cs,ce) + auto-scroll đoạn p
 else: render đoạn Text thường (như Spec 1)
```
**Vì sao match ở BE:** validate lúc upload (báo % khớp), app chỉ nhận offset sẵn.
**Lưu ở BE:** cột `Chapter.timingJson Json?` (import nhẹ, không async → không cần bảng/worker như HLS).

## 4. Backend
**DTO tạo/sửa chương** (`create-chapter.dto`, `update-chapter.dto`): thêm tuỳ chọn (variant DTO: hoãn)
- `timingRaw?: string` (nội dung file), `timingFormat?: 'srt'|'vtt'|'lrc'|'auto'` (default 'auto').

**Parser** (`timing-parser` util thuần):
- SRT: block cách dòng trống `idx / HH:MM:SS,mmm --> HH:MM:SS,mmm / text`.
- VTT: header `WEBVTT`; cue `HH:MM:SS.mmm --> …`; bỏ id/settings.
- LRC: `[mm:ss.xx] text`; `endMs`= start dòng kế; dòng cuối = `audioDuration*1000` (hoặc start+3000 nếu thiếu duration).
- auto: `WEBVTT`→vtt; có `[mm:ss`→lrc; else srt.
- Ra `cues[{startMs,endMs,text}]` (sắp theo startMs). File rỗng/rác → `[]`, không throw.

**Matcher** (`timing-matcher` util):
- Chia `content` theo `\n\s*\n` → paragraphs.
- Con trỏ chạy dọc content; mỗi cue tìm text kế tiếp so khớp **chuẩn hoá whitespace** (+ dung sai dấu câu nhẹ) → `paraIndex`, `charStart`, `charEnd` (offset trong đoạn).
- Cue không khớp → `paraIndex=-1` (giữ start/end). Trả `{cues, matched, total}`.

**Persist:** migration thêm `Chapter.timingJson Json?` (variant: hoãn). Set trong create/update khi có `timingRaw` (parse+match rồi lưu). Trả `{matched,total}` trong response admin.

**Serve:** `findPublicDetail` (`/chapters/:id/public`) thêm field `timing: chapter.timingJson` (null nếu chưa có). Không endpoint mới; không đụng entitlement.

**Admin FE (Next.js web admin):** thêm input file (accept .srt,.vtt,.lrc) cạnh ô audio trong form chương; đọc text file → gửi `timingRaw`+`timingFormat` trong payload; hiện kết quả `matched/total` sau khi lưu.

## 5. App (Flutter)
**Fetch:** `ChapterContent` (+ `ChapterMapper` trong `stories_repository.dart`) thêm `List<TimingCue> cues`; model `TimingCue { int startMs, endMs, paraIndex, charStart, charEnd }` map từ `timing.cues` (`{s,e,p,cs,ce}`). Không có → rỗng.

**Toggle:** tái dùng `ReaderStore` (Spec 1) — thêm `bool readAlong` (default **OFF**); getter/`saveReadAlong`. Chỗ bật: mục **READ-ALONG (Switch)** trong sheet Reading settings (Aa).
- **Active** = `readAlong` ON **và** `cues` không rỗng **và** đang phát audio chương này (`playingThis`).

**Highlight (giữ layout đoạn):**
- `ValueNotifier<int> _activeCue` cập nhật từ `AppState.position` (ms): cue có `s≤pos<e` (tìm tuyến tính/nhị phân trên cues sắp xếp). Chỉ đổi khi cue đổi → không rebuild toàn màn.
- Trong `_body`, đoạn `i` mà `activeCue.paraIndex==i` → render `Text.rich`: `[0,cs)` + **`[cs,ce)` tô sáng** (nền terracotta alpha ~0.25 + w600) + `[ce,end)`. Đoạn khác → `Text` thường. `cs/ce` clamp trong độ dài đoạn.
- `paraIndex=-1` → không tô, chỉ auto-scroll theo thời gian.

**Auto-scroll:** gán `GlobalKey` cho đoạn active; khi `_activeCue` đổi (đang active) → `Scrollable.ensureVisible(key.currentContext, alignment: 0.3, duration: 300ms)`. Chỉ khi active (không giành cuộn tay lúc đọc thường).

**Icon tai nghe top-bar (bổ sung, mức truyện):** trong `_topBar`, nút "Nghe" **chỉ render khi `chapters.any((c) => c.hasAudio)`** (dùng `bookHasAudio` — nhất quán BookDetail Spec 1); truyện không audio → ẩn. Bấm "Nghe" ở chương lẻ không audio → snackbar "Chương chưa có audio" (hành vi hiện có).

**Kết hợp Spec 1:** highlight nằm trong vòng render đoạn `_body`; sống chung tap-center/progress/resume/bookmark/brightness.

## 6. Lỗi & biên
- Không có timing → `cues` rỗng → không active; toggle bật được nhưng vô hiệu.
- Cue lệch (`paraIndex=-1`) → bỏ tô, vẫn auto-scroll.
- File sai định dạng (BE) → parser trả rỗng, KHÔNG lưu rác; `matched/total` báo admin.
- `content` đổi sau import → offset có thể lệch → khuyến nghị import lại; app clamp offset (không crash).
- Chương khoá → không phát → không active.
- offset vượt độ dài đoạn → clamp, bỏ tô câu đó.

## 7. Testing
- **BE parser unit:** SRT/VTT/LRC → cues đúng (ms, text); auto-detect; rỗng/rác → `[]` không throw.
- **BE matcher unit:** content+cues → offset đúng (bỏ qua whitespace); cue không khớp → `-1`; `matched/total`; đa đoạn.
- **App unit:** map `timing`→`List<TimingCue>`; tìm cue active theo position (biên s/e); `bookHasAudio` gate icon.
- **Thủ công máy:** import chương có SRT → phát audio + bật read-along → câu sáng + auto-scroll; tắt → thường; truyện không audio → **ẩn icon tai nghe**; offline → read-along tắt.

**Gói mới:** không cần (parser tự viết; app dùng `Text.rich`/`ensureVisible` sẵn có).

## 8. File dự kiến
**BE:** `src/chapters/dto/create-chapter.dto.ts`, `update-chapter.dto.ts`; util `src/chapters/timing/timing-parser.ts` + `timing-matcher.ts`; `chapters.service.ts` (parse+match+lưu), `findPublicDetail`; migration + `schema.prisma` (Chapter `timingJson`). (variant dto + `ChapterVariant.timingJson`: hoãn.)
**Admin FE:** form chương (thêm input file timing + gửi timingRaw).
**App:** `lib/data/reader/reader_models.dart`/`reader_store.dart` (readAlong bool), `lib/data/repositories/stories_repository.dart` (ChapterContent.cues + TimingCue + mapper), `lib/screens/novel/reader_screen.dart` (activeCue, Text.rich highlight, auto-scroll, toggle in settings, top-bar icon gate).

## 9. Thứ tự build
BE (parse/match/store/serve) + admin upload → App (consume/highlight/toggle/icon). BE-first vì app cần API `timing` để test thật.

## 10. Ghi chú
- Highlight mức **câu** (theo cue file), không mức từ.
- Read-along offline (lưu cues vào OfflineChapter) = follow-up nếu cần.
- Icon tai nghe: mức **truyện** (`chapters.any hasAudio`).
- **ChapterVariant timing = follow-up** (hoãn 2026-07-08, xem §2). v1 chỉ mức `Chapter`.
- **Matcher chuẩn hoá**: v1 coi mọi ký tự không phải chữ/số (`[^\p{L}\p{N}]`) là dấu tách mềm (whitespace + dấu câu) → dung sai dấu câu. Cue vắt qua ranh giới đoạn (`\n\s*\n`) → **không** khớp (giữ `p=-1`, không tính `matched`), tránh cắt cụt highlight.
