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
