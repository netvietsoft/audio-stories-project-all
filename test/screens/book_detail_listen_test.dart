import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/models/models.dart';
import 'package:novelverse/screens/novel/book_detail_screen.dart';

void main() {
  test('bookHasAudio true nếu có ít nhất 1 chương hasAudio', () {
    expect(bookHasAudio(const [
      Chapter(n: 1, title: 'a', state: ChapterState.free, hasAudio: false),
      Chapter(n: 2, title: 'b', state: ChapterState.free, hasAudio: true),
    ]), true);
  });
  test('bookHasAudio false nếu không chương nào có audio', () {
    expect(bookHasAudio(const [
      Chapter(n: 1, title: 'a', state: ChapterState.free, hasAudio: false),
    ]), false);
  });
}
