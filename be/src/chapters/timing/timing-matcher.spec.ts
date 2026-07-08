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
    // trailing '.' in the cue text is now a soft separator (Fix 1: punctuation tolerance),
    // so it is trimmed from the normalized cue and excluded from the matched span.
    expect(t.cues[0]).toEqual({ s: 0, e: 1000, p: 0, cs: 0, ce: 11 });
    expect(t.cues[1]).toEqual({ s: 1000, e: 2000, p: 1, cs: 0, ce: 21 });
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

  it('tolerates punctuation differences', () => {
    const punctContent = '"Anh yêu em," cô nói.';
    const t = matchCues(punctContent, [{ startMs: 0, endMs: 1000, text: 'Anh yêu em cô nói' }]);
    expect(t.matched).toBe(1);
    expect(t.cues[0].p).toBe(0);
    const { cs, ce } = t.cues[0];
    const substr = punctContent.substring(cs, ce);
    expect(substr).toContain('Anh');
    expect(substr).toContain('nói');
  });

  it('rejects a cue that spans a paragraph boundary', () => {
    const spanContent = 'Cô nhìn lên bầu trời.\n\nBầu trời đầy sao lấp lánh.';
    const t = matchCues(spanContent, [
      { startMs: 0, endMs: 1000, text: 'bầu trời Bầu trời đầy sao' },
      { startMs: 1000, endMs: 2000, text: 'lấp lánh' },
    ]);
    expect(t.cues[0]).toEqual({ s: 0, e: 1000, p: -1, cs: 0, ce: 0 });
    expect(t.cues[1].p).toBe(1);
    expect(t.matched).toBe(1);
    expect(t.total).toBe(2);
  });
});
