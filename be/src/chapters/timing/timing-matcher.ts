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
