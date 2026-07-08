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
