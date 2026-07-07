import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/mappers/chapter_mapper.dart';

void main() {
  test('hasAudio true khi audioDuration>0', () {
    final c = ChapterMapper.fromJson({'id': 'c1', 'chapterNumber': 1, 'title': 't', 'accessType': 'free', 'audioDuration': 120});
    expect(c.hasAudio, true);
  });
  test('hasAudio true khi có hlsUrl', () {
    final c = ChapterMapper.fromJson({'id': 'c1', 'title': 't', 'accessType': 'free', 'hlsUrl': 'http://x.m3u8'});
    expect(c.hasAudio, true);
  });
  test('hasAudio false khi không audio', () {
    final c = ChapterMapper.fromJson({'id': 'c1', 'title': 't', 'accessType': 'free'});
    expect(c.hasAudio, false);
  });
}
