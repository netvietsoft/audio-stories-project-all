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
