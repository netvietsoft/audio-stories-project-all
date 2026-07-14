import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/offline/offline_models.dart';

const _cueMap = {'s': 0, 'e': 1000, 'p': 0, 'cs': 0, 'ce': 5};

void main() {
  test('roundtrip toMap/fromMap giữ cues raw map', () {
    const ch = OfflineChapter(
        chapterId: 'c1', storyId: 's1', n: 1, title: 't', content: 'x',
        hasAudio: true, cues: [_cueMap]);
    final back = OfflineChapter.fromMap(ch.toMap());
    expect(back.cues, hasLength(1));
    expect(back.cues.first['s'], 0);
    expect(back.cues.first['ce'], 5);
  });

  test('map cũ (trước field cues) thiếu key → cues rỗng', () {
    final back = OfflineChapter.fromMap({
      'chapterId': 'c1', 'storyId': 's1', 'n': 1,
      'title': 't', 'content': 'x', 'hasAudio': false,
    });
    expect(back.cues, isEmpty);
  });

  test('copyWith giữ cues', () {
    const ch = OfflineChapter(
        chapterId: 'c1', storyId: 's1', n: 1, title: 't', content: 'x',
        hasAudio: true, cues: [_cueMap]);
    expect(ch.copyWith(audioFile: 'a.mp3').cues, hasLength(1));
  });
}
