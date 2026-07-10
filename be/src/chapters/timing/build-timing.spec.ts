import { buildTimingJson } from './build-timing';

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
