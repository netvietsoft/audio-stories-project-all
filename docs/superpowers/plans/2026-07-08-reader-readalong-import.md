# Reader Read-along (import timing) — Spec 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read-along: tô sáng câu đang đọc + auto-scroll theo audio, bằng file timing (SRT/VTT/LRC) admin import cùng audio — BE parse+match+serve, app highlight tại chỗ + toggle; icon tai nghe top-bar hiện theo mức truyện.

**Architecture:** BE (NestJS/Prisma) parse file → match cue-text vào `content` (offset theo đoạn) → lưu `Chapter.timingJson` → serve trong `/chapters/:id/public`. Admin (Next.js) thêm ô upload file timing cạnh audio. App (Flutter) nhận cues, toggle read-along (ReaderStore), highlight `Text.rich` + auto-scroll theo `AppState.position`.

**Tech Stack:** NestJS + Prisma + jest (ts-jest); Next.js admin; Flutter (just_audio, provider, shared_preferences). Không thư viện forced-alignment/ML. Không gói mới.

## Global Constraints
- **Hai repo git riêng:** BE + admin ở `D:\SetupC\Projects\NovelApp\backend` (commit tại đây); app ở `D:\SetupC\Projects\NovelApp\novelverse` (commit tại đây). Mỗi task commit đúng repo của nó.
- Kết commit body: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **timingJson shape (hợp đồng BE↔app):** `{ "v":1, "cues":[{"s":startMs,"e":endMs,"p":paraIndex,"cs":charStart,"ce":charEnd}], "matched":int, "total":int }`. Cue không khớp: `p=-1, cs=0, ce=0`. Thời gian là **ms nguyên**.
- Chia đoạn (cả BE match lẫn app render) DÙNG CHUNG regex `\n\s*\n` (rồi trim, bỏ đoạn rỗng) — để `paraIndex` khớp.
- Highlight mức **câu** (theo cue), không mức từ.
- Match ở BE: chuẩn hoá **lowercase + gộp khoảng trắng**; cue không khớp → `p=-1` (không throw). (Không strip dấu câu ở v1.)
- Read-along **active** (app) = toggle ON && cues không rỗng && đang phát audio chương này.
- Icon tai nghe top-bar: mức **truyện** (`chapters.any((c)=>c.hasAudio)`).
- Không đụng: entitlement `/chapters/:id/audio`, luồng HLS, `AppState`/offline core (chỉ đọc `position`).
- BE test: `node node_modules/jest/bin/jest.js <path>` (chạy trong `be/`). App test: `"/d/SetupC/flutter/bin/flutter.bat" test <path>` (flutter KHÔNG trong PATH).
- **Phạm vi v1:** chỉ `Chapter` (không `ChapterVariant`); read-along offline để follow-up. Ghi rõ nếu bỏ.

## File Structure
**BE (`backend/be`):**
- Create: `src/chapters/timing/timing-parser.ts` (+ `.spec.ts`) — parse SRT/VTT/LRC → cues.
- Create: `src/chapters/timing/timing-matcher.ts` (+ `.spec.ts`) — cues+content → timingJson.
- Modify: `prisma/schema.prisma` (Chapter `timingJson`), + migration.
- Modify: `src/chapters/dto/create-chapter.dto.ts`, `update-chapter.dto.ts` (timingRaw/timingFormat).
- Modify: `src/chapters/chapters.service.ts` (build+store timingJson ở create/update; select+trả `timing` ở findPublicDetail).
**Admin (`backend/fe/apps/admin`):**
- Modify: `src/app/[lang]/stories/[id]/chapters/_components/ChapterForm.tsx` (input file timing + payload), maybe `ChapterEditor.tsx` (pass-through spread — không cần sửa vì spread `...data`).
**App (`novelverse`):**
- Modify: `lib/data/reader/reader_store.dart` (readAlong bool) + `test/data/reader/reader_store_test.dart`.
- Modify: `lib/data/repositories/stories_repository.dart` (`ChapterContent.cues` + `TimingCue` + parse) + `test/data/timing_cue_test.dart`.
- Modify: `lib/screens/novel/reader_screen.dart` (toggle, activeCue, Text.rich highlight, auto-scroll, top-bar icon gate).

---

## Task 1: BE — timing parser (SRT/VTT/LRC)

**Files:**
- Create: `be/src/chapters/timing/timing-parser.ts`
- Test: `be/src/chapters/timing/timing-parser.spec.ts`

**Interfaces:**
- Produces: `export interface RawCue { startMs: number; endMs: number; text: string }`
  `export type TimingFormat = 'srt' | 'vtt' | 'lrc' | 'auto';`
  `export function parseTiming(raw: string, format: TimingFormat, audioDurationSec?: number): RawCue[]` — trả cues sắp theo startMs; rỗng/rác → `[]` (không throw).

- [ ] **Step 1: Viết test thất bại** — `timing-parser.spec.ts`

```ts
import { parseTiming } from './timing-parser';

describe('parseTiming', () => {
  it('parses SRT with start+end', () => {
    const srt = `1\n00:00:01,000 --> 00:00:03,500\nHello world\n\n2\n00:00:03,500 --> 00:00:06,000\nSecond line`;
    const cues = parseTiming(srt, 'srt');
    expect(cues.length).toBe(2);
    expect(cues[0]).toEqual({ startMs: 1000, endMs: 3500, text: 'Hello world' });
    expect(cues[1].startMs).toBe(3500);
    expect(cues[1].text).toBe('Second line');
  });

  it('parses VTT (dot millis, WEBVTT header, cue id ignored)', () => {
    const vtt = `WEBVTT\n\n1\n00:00:00.500 --> 00:00:02.000\nXin chào\n`;
    const cues = parseTiming(vtt, 'vtt');
    expect(cues).toEqual([{ startMs: 500, endMs: 2000, text: 'Xin chào' }]);
  });

  it('parses LRC (start only; end = next start; last = duration)', () => {
    const lrc = `[00:01.00]Dòng một\n[00:03.50]Dòng hai`;
    const cues = parseTiming(lrc, 'lrc', 6);
    expect(cues[0]).toEqual({ startMs: 1000, endMs: 3500, text: 'Dòng một' });
    expect(cues[1]).toEqual({ startMs: 3500, endMs: 6000, text: 'Dòng hai' });
  });

  it('auto-detects format', () => {
    expect(parseTiming('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nA', 'auto').length).toBe(1);
    expect(parseTiming('[00:01.00]A', 'auto')[0].text).toBe('A');
    expect(parseTiming('1\n00:00:01,000 --> 00:00:02,000\nA', 'auto')[0].startMs).toBe(1000);
  });

  it('returns [] on garbage / empty', () => {
    expect(parseTiming('', 'auto')).toEqual([]);
    expect(parseTiming('not a timing file', 'srt')).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test → FAIL**

Run (trong `be/`): `node node_modules/jest/bin/jest.js src/chapters/timing/timing-parser.spec.ts`
Expected: FAIL (module chưa có).

- [ ] **Step 3: Viết `timing-parser.ts`**

```ts
export interface RawCue {
  startMs: number;
  endMs: number;
  text: string;
}
export type TimingFormat = 'srt' | 'vtt' | 'lrc' | 'auto';

function hmsToMs(h: string, m: string, s: string, ms: string): number {
  return (
    (parseInt(h, 10) || 0) * 3600000 +
    (parseInt(m, 10) || 0) * 60000 +
    (parseInt(s, 10) || 0) * 1000 +
    (parseInt(ms.padEnd(3, '0').slice(0, 3), 10) || 0)
  );
}

// SRT/VTT share the "HH:MM:SS[,.]mmm --> HH:MM:SS[,.]mmm" cue timeline.
function parseSrtVtt(raw: string): RawCue[] {
  const cues: RawCue[] = [];
  const timeRe =
    /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/;
  const blocks = raw.replace(/\r/g, '').split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const tIdx = lines.findIndex((l) => timeRe.test(l));
    if (tIdx < 0) continue;
    const mt = lines[tIdx].match(timeRe)!;
    const startMs = hmsToMs(mt[1], mt[2], mt[3], mt[4]);
    const endMs = hmsToMs(mt[5], mt[6], mt[7], mt[8]);
    const text = lines.slice(tIdx + 1).join(' ').trim();
    if (text) cues.push({ startMs, endMs, text });
  }
  return cues;
}

// LRC: [mm:ss.xx] text  (start only). end = next start; last = duration (or +3s).
function parseLrc(raw: string, audioDurationSec?: number): RawCue[] {
  const lineRe = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,2}))?\]\s*(.*)$/;
  const tmp: { startMs: number; text: string }[] = [];
  for (const line of raw.replace(/\r/g, '').split('\n')) {
    const m = line.match(lineRe);
    if (!m) continue;
    const centis = m[3] ? parseInt(m[3].padEnd(2, '0').slice(0, 2), 10) : 0;
    const startMs = (parseInt(m[1], 10) || 0) * 60000 + (parseInt(m[2], 10) || 0) * 1000 + centis * 10;
    const text = (m[4] || '').trim();
    if (text) tmp.push({ startMs, text });
  }
  tmp.sort((a, b) => a.startMs - b.startMs);
  return tmp.map((c, i) => ({
    startMs: c.startMs,
    endMs: i + 1 < tmp.length ? tmp[i + 1].startMs : (audioDurationSec ? audioDurationSec * 1000 : c.startMs + 3000),
    text: c.text,
  }));
}

function detect(raw: string): 'srt' | 'vtt' | 'lrc' {
  const head = raw.trimStart();
  if (/^WEBVTT/.test(head)) return 'vtt';
  if (/^\s*\[\d{1,2}:\d{2}/.test(head)) return 'lrc';
  return 'srt';
}

export function parseTiming(raw: string, format: TimingFormat, audioDurationSec?: number): RawCue[] {
  if (!raw || !raw.trim()) return [];
  const fmt = format === 'auto' ? detect(raw) : format;
  const cues = fmt === 'lrc' ? parseLrc(raw, audioDurationSec) : parseSrtVtt(raw);
  return cues.sort((a, b) => a.startMs - b.startMs);
}
```

- [ ] **Step 4: Chạy test → PASS**

Run: `node node_modules/jest/bin/jest.js src/chapters/timing/timing-parser.spec.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit** (trong `backend/`)

```bash
git add be/src/chapters/timing/timing-parser.ts be/src/chapters/timing/timing-parser.spec.ts
git commit -m "feat(chapters): timing file parser (SRT/VTT/LRC)"
```

---

## Task 2: BE — timing matcher (cues → content offsets)

**Files:**
- Create: `be/src/chapters/timing/timing-matcher.ts`
- Test: `be/src/chapters/timing/timing-matcher.spec.ts`

**Interfaces:**
- Consumes: `RawCue` (Task 1).
- Produces:
  `export interface MappedCue { s: number; e: number; p: number; cs: number; ce: number }`
  `export interface ChapterTiming { v: 1; cues: MappedCue[]; matched: number; total: number }`
  `export function matchCues(content: string, cues: RawCue[]): ChapterTiming` — ánh xạ tuần tự cue-text vào content; chuẩn hoá lowercase+gộp whitespace; cue không khớp → `{p:-1,cs:0,ce:0}`.

- [ ] **Step 1: Viết test thất bại** — `timing-matcher.spec.ts`

```ts
import { matchCues } from './timing-matcher';

describe('matchCues', () => {
  const content = 'Hello world.\n\nSecond paragraph here.';
  it('maps cues to paragraph + char offsets', () => {
    const t = matchCues(content, [
      { startMs: 0, endMs: 1000, text: 'Hello world.' },
      { startMs: 1000, endMs: 2000, text: 'Second paragraph here.' },
    ]);
    expect(t.total).toBe(2);
    expect(t.matched).toBe(2);
    expect(t.cues[0]).toEqual({ s: 0, e: 1000, p: 0, cs: 0, ce: 12 });
    expect(t.cues[1]).toEqual({ s: 1000, e: 2000, p: 1, cs: 0, ce: 22 });
  });

  it('tolerates whitespace + case differences', () => {
    const t = matchCues('Xin  chào\nthế giới', [{ startMs: 0, endMs: 1, text: 'xin chào thế giới' }]);
    expect(t.matched).toBe(1);
    expect(t.cues[0].p).toBe(0);
  });

  it('marks unmatched cue with p=-1 but keeps timing', () => {
    const t = matchCues('abc', [{ startMs: 5, endMs: 9, text: 'not present' }]);
    expect(t.matched).toBe(0);
    expect(t.cues[0]).toEqual({ s: 5, e: 9, p: -1, cs: 0, ce: 0 });
  });
});
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `node node_modules/jest/bin/jest.js src/chapters/timing/timing-matcher.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Viết `timing-matcher.ts`**

```ts
import { RawCue } from './timing-parser';

export interface MappedCue { s: number; e: number; p: number; cs: number; ce: number }
export interface ChapterTiming { v: 1; cues: MappedCue[]; matched: number; total: number }

// Chia đoạn giống app: \n\s*\n, trim, bỏ rỗng. Giữ char-offset gốc của mỗi đoạn.
function splitParas(content: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  const re = /\n\s*\n/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (rawStart: number, rawEnd: number) => {
    const seg = content.slice(rawStart, rawEnd);
    const trimmed = seg.trim();
    if (!trimmed) return;
    const lead = seg.length - seg.trimStart().length;
    out.push({ text: trimmed, start: rawStart + lead });
  };
  while ((m = re.exec(content)) !== null) {
    push(last, m.index);
    last = m.index + m[0].length;
  }
  push(last, content.length);
  return out;
}

// Chuẩn hoá lowercase + gộp whitespace; trả chuỗi norm + map[norm i] -> original index.
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      if (!prevSpace && norm.length > 0) { norm += ' '; map.push(i); prevSpace = true; }
    } else {
      norm += ch.toLowerCase(); map.push(i); prevSpace = false;
    }
  }
  // bỏ space cuối
  while (norm.endsWith(' ')) { norm = norm.slice(0, -1); map.pop(); }
  return { norm, map };
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function matchCues(content: string, cues: RawCue[]): ChapterTiming {
  const paras = splitParas(content);
  const { norm, map } = normalizeWithMap(content);
  let cursor = 0;
  let matched = 0;
  const out: MappedCue[] = cues.map((cue) => {
    const nt = normalizeText(cue.text);
    let p = -1, cs = 0, ce = 0;
    if (nt) {
      const idx = norm.indexOf(nt, cursor);
      if (idx >= 0) {
        const origStart = map[idx];
        const origEnd = map[idx + nt.length - 1] + 1;
        cursor = idx + nt.length;
        const pi = paras.findIndex((pp) => origStart >= pp.start && origStart < pp.start + pp.text.length);
        if (pi >= 0) {
          p = pi;
          cs = origStart - paras[pi].start;
          ce = Math.min(origEnd - paras[pi].start, paras[pi].text.length);
          matched++;
        }
      }
    }
    return { s: cue.startMs, e: cue.endMs, p, cs, ce };
  });
  return { v: 1, cues: out, matched, total: cues.length };
}
```

- [ ] **Step 4: Chạy test → PASS**

Run: `node node_modules/jest/bin/jest.js src/chapters/timing/timing-matcher.spec.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add be/src/chapters/timing/timing-matcher.ts be/src/chapters/timing/timing-matcher.spec.ts
git commit -m "feat(chapters): timing matcher (cues -> content offsets)"
```

---

## Task 3: BE — schema migration + DTO fields

**Files:**
- Modify: `be/prisma/schema.prisma` (Chapter model, ~line 520)
- Modify: `be/src/chapters/dto/create-chapter.dto.ts`, `be/src/chapters/dto/update-chapter.dto.ts`
- Test: (không unit; verify prisma generate + build)

**Interfaces:**
- Produces: `Chapter.timingJson Json?` column; DTO fields `timingRaw?: string`, `timingFormat?: 'srt'|'vtt'|'lrc'|'auto'`.

- [ ] **Step 1: Thêm cột vào `schema.prisma`** — trong `model Chapter { ... }`, cạnh `audioDuration` (line ~532) thêm:
```prisma
  timingJson    Json?             @map("timing_json")
```

- [ ] **Step 2: Tạo migration**

Run (trong `be/`): `node node_modules/prisma/build/index.js migrate dev --name add_chapter_timing_json`
Expected: migration mới trong `prisma/migrations/`, `prisma generate` chạy, không lỗi. (Nếu môi trường không cho `migrate dev`, dùng `node node_modules/prisma/build/index.js migrate diff` + `db execute`, hoặc báo BLOCKED.)

- [ ] **Step 3: Thêm field vào 2 DTO** — cuối `CreateChapterDto` và `UpdateChapterDto` thêm:
```ts
  @IsOptional()
  @IsString()
  @MaxLength(2000000)
  timingRaw?: string;

  @IsOptional()
  @IsEnum(['srt', 'vtt', 'lrc', 'auto'] as any)
  timingFormat?: 'srt' | 'vtt' | 'lrc' | 'auto';
```
> Nếu `@IsEnum` với mảng literal bị lỗi type: thay bằng `@IsString() @IsIn(['srt','vtt','lrc','auto'])` (import `IsIn` từ class-validator).

- [ ] **Step 4: Verify build**

Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (trong `be/`)
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add be/prisma/schema.prisma be/prisma/migrations be/src/chapters/dto/create-chapter.dto.ts be/src/chapters/dto/update-chapter.dto.ts
git commit -m "feat(chapters): timingJson column + timingRaw/timingFormat DTO fields"
```

---

## Task 4: BE — build + store timing in create/update; serve in public detail

**Files:**
- Modify: `be/src/chapters/chapters.service.ts`
- Create + Test: `be/src/chapters/timing/build-timing.ts` (+ `build-timing.spec.ts`) — helper thuần
- Test: `be/src/chapters/timing/build-timing.spec.ts` (unit cho helper thuần)

**Interfaces:**
- Consumes: `parseTiming` (T1), `matchCues` (T2), DTO fields (T3).
- Produces: private helper `buildTimingJson(content, timingRaw, timingFormat, audioDurationSec): ChapterTiming | null`; wiring vào `create`/`createStandalone`/`update`; `findPublicDetail` trả `timing`.

- [ ] **Step 1: Viết test thất bại** cho helper (tách helper thuần, test không DB) — `be/src/chapters/timing/build-timing.spec.ts`

```ts
import { buildTimingJson } from './timing/build-timing';

describe('buildTimingJson', () => {
  it('returns null when no timingRaw', () => {
    expect(buildTimingJson('content', undefined, 'auto', 10)).toBeNull();
    expect(buildTimingJson('content', '', 'auto', 10)).toBeNull();
  });
  it('parses + matches into ChapterTiming', () => {
    const srt = '1\n00:00:00,000 --> 00:00:01,000\nHello world.';
    const t = buildTimingJson('Hello world.', srt, 'srt', 5)!;
    expect(t.total).toBe(1);
    expect(t.matched).toBe(1);
    expect(t.cues[0].p).toBe(0);
  });
});
```
> Để test không DB, đặt helper thuần ở `be/src/chapters/timing/build-timing.ts` và service import nó.

- [ ] **Step 2: Chạy test → FAIL**

Run: `node node_modules/jest/bin/jest.js src/chapters/timing/build-timing.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Viết helper `be/src/chapters/timing/build-timing.ts`**

```ts
import { parseTiming, TimingFormat } from './timing-parser';
import { matchCues, ChapterTiming } from './timing-matcher';

export function buildTimingJson(
  content: string | null | undefined,
  timingRaw: string | null | undefined,
  timingFormat: TimingFormat | undefined,
  audioDurationSec?: number,
): ChapterTiming | null {
  if (!timingRaw || !timingRaw.trim() || !content) return null;
  const cues = parseTiming(timingRaw, timingFormat ?? 'auto', audioDurationSec);
  if (cues.length === 0) return null;
  return matchCues(content, cues);
}
```
(spec import `./build-timing`.)

- [ ] **Step 4: Wire vào `chapters.service.ts`**

Thêm import đầu file: `import { buildTimingJson } from './timing/build-timing';`

Trong `create` (line ~786): sau khi có `normalizedData` và trước `this.prisma.chapter.create`, chèn timingJson:
```ts
    const timing = buildTimingJson(
      (data as any).content, (data as any).timingRaw, (data as any).timingFormat, (data as any).audioDuration);
    if (timing) (normalizedData as any).timingJson = timing;
```
> `normalizeChapterFlatPayload` không biết `timingRaw/timingFormat` → đảm bảo chúng KHÔNG bị ghi thành cột. Kiểm tra `normalizeChapterFlatPayload`: nếu nó copy nguyên data, thêm `delete (normalizedData as any).timingRaw; delete (normalizedData as any).timingFormat;` sau dòng trên.

Lặp tương tự trong `createStandalone` (~830, dùng `chapterData`) và `update` (~863): trong `update`, sau khi dựng data cập nhật, nếu `data.timingRaw !== undefined` thì `updateData.timingJson = buildTimingJson(data.content ?? chapter.content, data.timingRaw, data.timingFormat, data.audioDuration ?? chapter.audioDuration) ?? Prisma.JsonNull;` và xoá `timingRaw/timingFormat` khỏi payload ghi. (Đọc code update để đặt đúng chỗ dựng `updateData`.)

Trong `findPublicDetail` (line 219 select): thêm `timingJson: true,`. Sau khi build kết quả trả về (nơi đã gắn hlsUrl, ~sau line 270), thêm `timing: chapter.timingJson ?? null` vào object trả về cho client.

- [ ] **Step 5: Chạy test helper → PASS + build**

Run: `node node_modules/jest/bin/jest.js src/chapters/timing/build-timing.spec.ts` → PASS.
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → no errors.

- [ ] **Step 6: Commit**

```bash
git add be/src/chapters/timing/build-timing.ts be/src/chapters/timing/build-timing.spec.ts be/src/chapters/chapters.service.ts
git commit -m "feat(chapters): store timingJson on create/update + serve in public detail"
```

---

## Task 5: Admin — timing file upload field

**Files:**
- Modify: `backend/fe/apps/admin/src/app/[lang]/stories/[id]/chapters/_components/ChapterForm.tsx`
- Test: (không unit; verify typecheck + manual)

**Interfaces:**
- Consumes: BE DTO `timingRaw`/`timingFormat` (T3).
- Produces: input file (.srt,.vtt,.lrc) cạnh audio; đọc text → set form; payload thêm `timingRaw`+`timingFormat`.

- [ ] **Step 1: Thêm state + handler đọc file** — trong `ChapterForm` (gần các handler audio, ~line 400), thêm:
```tsx
  const handleTimingFileSelect = async (file: File | null | undefined) => {
    if (!file) return;
    const text = await file.text();
    const name = file.name.toLowerCase();
    const fmt = name.endsWith('.vtt') ? 'vtt' : name.endsWith('.lrc') ? 'lrc' : name.endsWith('.srt') ? 'srt' : 'auto';
    setValue('timingRaw', text);
    setValue('timingFormat', fmt as any);
  };
```
> `timingRaw`/`timingFormat` phải là field trong zod schema + form values. Thêm chúng vào schema/defaultValues của form (tìm chỗ khai schema `z.object({...})` trong file, thêm `timingRaw: z.string().optional(), timingFormat: z.string().optional()`).

- [ ] **Step 2: Thêm input JSX** — ngay sau khối "Audio Upload" (sau ~line 1106, trước Thumbnail):
```tsx
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-600 mb-1">File timing read-along (SRT/VTT/LRC)</label>
                <input
                  type="file"
                  accept=".srt,.vtt,.lrc"
                  onChange={(e) => handleTimingFileSelect(e.target.files?.[0])}
                  className="block w-full text-sm"
                />
                {watch('timingRaw') ? <p className="text-xs text-emerald-600 mt-1">Đã nạp file timing.</p> : null}
              </div>
```

- [ ] **Step 3: Thêm vào payload submit** — trong `handleFormSubmit`'s `payload` (ChapterSubmitPayload, ~line 800) thêm:
```tsx
    timingRaw: cleanText(values.timingRaw) ?? undefined,
    timingFormat: (values.timingFormat as any) ?? undefined,
```
Và thêm 2 field vào type `ChapterSubmitPayload` (~line 95): `timingRaw?: string; timingFormat?: 'srt'|'vtt'|'lrc'|'auto';`.
> `ChapterEditor.handleSubmit` spread `...data` nên timingRaw/timingFormat tự đi theo POST/PATCH — không cần sửa ChapterEditor.

- [ ] **Step 4: Verify** (trong `fe/apps/admin`)

Run: `node ../../node_modules/typescript/bin/tsc --noEmit` (hoặc `npm run typecheck` trong apps/admin) → no errors.
Thủ công: mở form sửa chương → thấy ô "File timing" → chọn .srt → lưu → BE trả matched/total (xem network) và chương có `timing` khi gọi `/chapters/:id/public`.

- [ ] **Step 5: Commit**

```bash
git add "fe/apps/admin/src/app/[lang]/stories/[id]/chapters/_components/ChapterForm.tsx"
git commit -m "feat(admin): upload read-along timing file with chapter audio"
```

---

## Task 6: App — TimingCue model + fetch cues

**Files:**
- Modify: `novelverse/lib/data/repositories/stories_repository.dart`
- Test: `novelverse/test/data/timing_cue_test.dart`

**Interfaces:**
- Produces:
  `class TimingCue { final int startMs, endMs, paraIndex, charStart, charEnd; const TimingCue(...); factory TimingCue.fromMap(Map); }`
  `ChapterContent` thêm `final List<TimingCue> cues;` (default `const []`).
  Static helper `int? activeCueIndex(List<TimingCue> cues, int posMs)` → index cue có `startMs<=pos<endMs`, else null.

- [ ] **Step 1: Viết test thất bại** — `test/data/timing_cue_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/repositories/stories_repository.dart';

void main() {
  test('TimingCue.fromMap maps s/e/p/cs/ce', () {
    final c = TimingCue.fromMap({'s': 100, 'e': 200, 'p': 2, 'cs': 3, 'ce': 9});
    expect(c.startMs, 100);
    expect(c.endMs, 200);
    expect(c.paraIndex, 2);
    expect(c.charStart, 3);
    expect(c.charEnd, 9);
  });

  test('activeCueIndex finds cue containing position, else null', () {
    final cues = [
      const TimingCue(startMs: 0, endMs: 1000, paraIndex: 0, charStart: 0, charEnd: 5),
      const TimingCue(startMs: 1000, endMs: 2000, paraIndex: 0, charStart: 5, charEnd: 10),
    ];
    expect(activeCueIndex(cues, 500), 0);
    expect(activeCueIndex(cues, 1000), 1);
    expect(activeCueIndex(cues, 5000), isNull);
    expect(activeCueIndex(const [], 100), isNull);
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/timing_cue_test.dart`
Expected: FAIL.

- [ ] **Step 3: Sửa `stories_repository.dart`**

3a. Thêm class `TimingCue` (trên `ChapterContent`):
```dart
/// 1 câu timing read-along (ms + vị trí ký tự trong đoạn `paraIndex`).
class TimingCue {
  const TimingCue({
    required this.startMs, required this.endMs,
    required this.paraIndex, required this.charStart, required this.charEnd,
  });
  final int startMs, endMs, paraIndex, charStart, charEnd;

  factory TimingCue.fromMap(Map m) {
    int i(dynamic v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;
    return TimingCue(
      startMs: i(m['s']), endMs: i(m['e']), paraIndex: m['p'] is num ? (m['p'] as num).toInt() : -1,
      charStart: i(m['cs']), charEnd: i(m['ce']),
    );
  }
}

/// Index cue đang phát (startMs<=pos<endMs), hoặc null. cues giả định sắp theo startMs.
int? activeCueIndex(List<TimingCue> cues, int posMs) {
  for (var i = 0; i < cues.length; i++) {
    if (posMs >= cues[i].startMs && posMs < cues[i].endMs) return i;
  }
  return null;
}
```

3b. Thêm `cues` vào `ChapterContent`:
```dart
class ChapterContent {
  const ChapterContent({
    required this.id, required this.n, required this.title, required this.content,
    this.hlsUrl, this.cues = const [],
  });
  final String id;
  final int n;
  final String title;
  final String content;
  final String? hlsUrl;
  final List<TimingCue> cues;
}
```

3c. Trong `chapterContent`, khi dựng `content` từ API (sau line 197), parse `timing`:
```dart
    final timingMap = m['timing'];
    final cues = (timingMap is Map && timingMap['cues'] is List)
        ? (timingMap['cues'] as List).whereType<Map>().map(TimingCue.fromMap).toList()
        : <TimingCue>[];
    final content = ChapterContent(
      id: (m['id'] ?? id).toString(),
      n: _int(m['chapterNumber'], 1),
      title: (m['title'] ?? '').toString(),
      content: (m['content'] ?? '').toString(),
      hlsUrl: m['hlsUrl']?.toString(),
      cues: cues,
    );
```
(local-first branch trả `ChapterContent(... )` không có cues → `const []`, OK — read-along offline follow-up.)

- [ ] **Step 4: Chạy test → PASS**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/timing_cue_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit** (trong `novelverse/`)

```bash
git add lib/data/repositories/stories_repository.dart test/data/timing_cue_test.dart
git commit -m "feat(reader): TimingCue model + fetch read-along cues"
```

---

## Task 7: App — read-along toggle in ReaderStore

**Files:**
- Modify: `novelverse/lib/data/reader/reader_store.dart`
- Test: `novelverse/test/data/reader/reader_store_test.dart` (thêm case)

**Interfaces:**
- Produces: `bool readReadAlong()` (default false), `Future<void> saveReadAlong(bool)`.

- [ ] **Step 1: Thêm test** vào `reader_store_test.dart` (trong `main()`):
```dart
  test('readAlong default false, round-trip', () async {
    expect(store.readReadAlong(), false);
    await store.saveReadAlong(true);
    expect(store.readReadAlong(), true);
  });
```

- [ ] **Step 2: Chạy → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/reader/reader_store_test.dart`
Expected: FAIL (method chưa có).

- [ ] **Step 3: Thêm vào `reader_store.dart`** (cạnh brightness):
```dart
  static const _kReadAlong = 'reader.readalong';
  bool readReadAlong() => _prefs.getBool(_kReadAlong) ?? false;
  Future<void> saveReadAlong(bool v) => _prefs.setBool(_kReadAlong, v);
```

- [ ] **Step 4: Chạy → PASS**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/reader/reader_store_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/reader/reader_store.dart test/data/reader/reader_store_test.dart
git commit -m "feat(reader): persist read-along toggle in ReaderStore"
```

---

## Task 8: App — reader read-along (toggle UI + highlight + auto-scroll)

**Files:**
- Modify: `novelverse/lib/screens/novel/reader_screen.dart`
- Test: (không unit — logic thuần đã test ở T6; verify analyze + manual)

**Interfaces:**
- Consumes: `ChapterContent.cues`, `TimingCue`, `activeCueIndex` (T6); `ReaderStore.readReadAlong/saveReadAlong` (T7); `AppState.position` (ms).

- [ ] **Step 1: State + nạp cues + toggle**

Trong `_ReaderScreenState`: thêm fields:
```dart
  bool _readAlong = false;
  List<TimingCue> _cues = const [];
  final ValueNotifier<int> _activeCue = ValueNotifier(-1);
```
Trong `initState` (cạnh nạp settings): `_readAlong = _reader.readReadAlong();`
Trong `dispose`: `_activeCue.dispose();`
Trong `_loadContent`, khi set nội dung online, lưu cues: sau `_setContent(c.content.trim())` thêm `_cues = c.cues;` (đọc `ChapterContent c` — hiện `_loadContent` gọi `_repo.chapterContent`; giữ biến `c` để lấy `c.cues`). Khi đổi chương reset: `_activeCue.value = -1;` trong `_goChapter`.

- [ ] **Step 2: Nghe position → cập nhật activeCue (chỉ khi active)**

Thêm helper + listener. Trong `build`, xác định `playingThis` đã có (Spec 1). Thêm:
```dart
  bool get _readAlongActive => _readAlong && _cues.isNotEmpty;

  void _syncActiveCue(AppState app) {
    if (!_readAlongActive) { if (_activeCue.value != -1) _activeCue.value = -1; return; }
    final idx = activeCueIndex(_cues, app.position.value.inMilliseconds) ?? -1;
    if (idx != _activeCue.value) {
      _activeCue.value = idx;
      // auto-scroll tới đoạn của cue (nếu có key)
      if (idx >= 0 && _cues[idx].paraIndex >= 0) _scrollToPara(_cues[idx].paraIndex);
    }
  }
```
Đăng ký nghe `app.position` khi playingThis: trong `build`, sau khi có `app`, thêm 1 `ValueListenableBuilder<Duration>(valueListenable: app.position, builder: (_, __, ___) { _syncActiveCue(app); return const SizedBox.shrink(); })` đặt trong cây widget (vd trong Stack) để mỗi tick position gọi `_syncActiveCue`. (Không setState — chỉ cập nhật `_activeCue` notifier.)

- [ ] **Step 3: Highlight trong render đoạn (Text.rich)**

Trong `_body`, chỗ render mỗi đoạn `paras[i]` (SliverList builder, đoạn Spec 1), bọc bằng `ValueListenableBuilder<int>(valueListenable: _activeCue, ...)` chỉ cho đoạn đang active; hàm dựng:
```dart
  Widget _paragraph(int i, String text, TextStyle base, Color ink, GlobalKey? key) {
    return ValueListenableBuilder<int>(
      valueListenable: _activeCue,
      builder: (_, active, __) {
        final cue = (active >= 0 && active < _cues.length) ? _cues[active] : null;
        if (!_readAlongActive || cue == null || cue.paraIndex != i || cue.paraIndex < 0) {
          return Text(text, key: key, style: base);
        }
        final cs = cue.charStart.clamp(0, text.length);
        final ce = cue.charEnd.clamp(cs, text.length);
        return Text.rich(
          key: key,
          TextSpan(style: base, children: [
            TextSpan(text: text.substring(0, cs)),
            TextSpan(text: text.substring(cs, ce), style: base.copyWith(
              backgroundColor: AppPalette.terracotta.withValues(alpha: 0.25),
              fontWeight: FontWeight.w600)),
            TextSpan(text: text.substring(ce)),
          ]),
        );
      },
    );
  }
```
Thay chỗ dựng `Text(paras[i], style: base)` hiện tại bằng `_paragraph(i, paras[i], base, ink, _paraKey(i))`. Thêm quản lý GlobalKey:
```dart
  final Map<int, GlobalKey> _paraKeys = {};
  GlobalKey _paraKey(int i) => _paraKeys.putIfAbsent(i, () => GlobalKey());
```
Reset `_paraKeys.clear();` trong `_goChapter`.

- [ ] **Step 4: Auto-scroll**

```dart
  void _scrollToPara(int i) {
    final key = _paraKeys[i];
    final ctx = key?.currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(ctx, alignment: 0.3, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    }
  }
```

- [ ] **Step 5: Toggle trong sheet Aa**

Trong `_openSettings`, sau mục BRIGHTNESS, thêm:
```dart
                label('READ-ALONG'),
                Row(children: [
                  Expanded(child: Text('Tô sáng câu theo audio', style: AppType.body(size: 13.5, color: pal.ink))),
                  Switch(
                    value: _readAlong,
                    activeColor: AppPalette.terracotta,
                    onChanged: (v) => upd(() => _readAlong = v),
                  ),
                ]),
```
Và trong `_persistSettings` KHÔNG lưu readAlong (nó riêng). Thêm ghi khi đổi: sửa `upd` hiện tại vẫn gọi `_persistSettings` cho settings; thêm 1 lệnh lưu readAlong khi toggle — đơn giản nhất: `onChanged: (v) { upd(() => _readAlong = v); _reader.saveReadAlong(v); }`.

- [ ] **Step 6: Verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze lib/screens/novel/reader_screen.dart` → No issues (bỏ qua pre-existing infos).
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/screens/novel/reader_screen.dart
git commit -m "feat(reader): read-along highlight + auto-scroll + toggle"
```

---

## Task 9: App — top-bar headphones icon gated by story audio

**Files:**
- Modify: `novelverse/lib/screens/novel/reader_screen.dart`
- Test: (verify analyze + manual)

**Interfaces:**
- Consumes: `bookHasAudio(List<Chapter>)` (đã có từ Spec 1 trong `book_detail_screen.dart` — import nó, hoặc dùng `chapters.any((c)=>c.hasAudio)` trực tiếp).

- [ ] **Step 1: Gate nút "Nghe" trong `_topBar`**

Trong `_topBar(...)`, nút headphones (IconButton tooltip 'Nghe') hiện luôn. Bọc điều kiện: chỉ render khi `chapters.any((c) => c.hasAudio)`. `_topBar` cần biết `chapters` — thêm tham số `List<Chapter> chapters` nếu chưa có (nó đã nhận `chapters` từ Spec 1 Task 7). Sửa:
```dart
            if (chapters.any((c) => c.hasAudio))
              IconButton(tooltip: 'Nghe', icon: Icon(Icons.headphones_outlined, color: ink), onPressed: locked ? null : () => _playChapterAudio(book, ch)),
```
(nếu không có audio → không thêm IconButton này vào Row actions).

- [ ] **Step 2: Verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze lib/screens/novel/reader_screen.dart` → No issues.
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → all pass.
Thủ công: truyện không audio → **không thấy icon tai nghe**; truyện có audio → thấy.

- [ ] **Step 3: Commit**

```bash
git add lib/screens/novel/reader_screen.dart
git commit -m "feat(reader): hide top-bar headphones when story has no audio"
```

---

## Task 10: Full verify + build

- [ ] **Step 1: BE** — `node node_modules/jest/bin/jest.js src/chapters/timing` → all PASS; `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → no errors.
- [ ] **Step 2: App** — `"/d/SetupC/flutter/bin/flutter.bat" test` → all PASS; `"/d/SetupC/flutter/bin/flutter.bat" analyze` → 0 error/warning.
- [ ] **Step 3: Build + cài máy** — build APK `--dart-define=USE_BACKEND=true --dart-define=API_BASE_URL=https://api.dreamtap.me`; cài qua adb (USB hoặc WiFi pairing). Kịch bản: admin import SRT cho 1 chương (trên web admin trỏ BE tương ứng) → app phát audio + bật read-along → câu sáng theo giọng + auto-scroll; tắt toggle → thường; truyện không audio → ẩn icon tai nghe.
- [ ] **Step 4: Commit** nếu có chỉnh vặt.

## Ghi chú
- **ChapterVariant** timing: bỏ ở v1 (chỉ Chapter). Follow-up nếu interactive story cần.
- **Read-along offline**: chương đã tải chưa lưu cues → tắt khi offline. Follow-up (lưu cues vào OfflineChapter).
- **`normalizeChapterFlatPayload`**: xác nhận nó không ghi `timingRaw/timingFormat` thành cột (xoá khỏi payload nếu cần) — Task 4 Step 4.
- **Match punctuation**: v1 chuẩn hoá lowercase+whitespace (không strip dấu câu). Cue lệch dấu câu → `p=-1` (bỏ highlight, vẫn auto-scroll). Nâng sau nếu cần.
- BE prod migrate: dùng `migrate deploy` khi deploy (không nằm trong plan này).
