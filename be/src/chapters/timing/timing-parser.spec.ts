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
