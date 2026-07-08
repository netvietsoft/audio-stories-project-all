import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:novelverse/data/reader/reader_models.dart';
import 'package:novelverse/data/reader/reader_store.dart';

void main() {
  late ReaderStore store;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    store = ReaderStore(await SharedPreferences.getInstance());
  });

  test('settings mặc định khi trống, round-trip sau khi lưu', () async {
    expect(store.readSettings().fontSize, 18);
    await store.saveSettings(const ReaderSettings(fontSize: 22, bg: 2));
    expect(store.readSettings().fontSize, 22);
    expect(store.readSettings().bg, 2);
  });

  test('position: null khi chưa có, đọc đúng sau khi lưu', () async {
    expect(store.position('b1'), isNull);
    await store.savePosition('b1', 4, 88.0);
    final p = store.position('b1')!;
    expect(p.chapter, 4);
    expect(p.offset, 88.0);
  });

  test('bookmark add → list → remove', () async {
    expect(store.bookmarks('b1'), isEmpty);
    await store.addBookmark('b1', const Bookmark(chapter: 1, offset: 0, snippet: 'a', savedAt: 100));
    await store.addBookmark('b1', const Bookmark(chapter: 2, offset: 5, snippet: 'b', savedAt: 200));
    expect(store.bookmarks('b1').length, 2);
    await store.removeBookmark('b1', 100);
    final left = store.bookmarks('b1');
    expect(left.length, 1);
    expect(left.first.savedAt, 200);
  });

  test('brightness mặc định -1, round-trip', () async {
    expect(store.readBrightness(), -1);
    await store.saveBrightness(0.6);
    expect(store.readBrightness(), 0.6);
  });

  test('readAlong default false, round-trip', () async {
    expect(store.readReadAlong(), false);
    await store.saveReadAlong(true);
    expect(store.readReadAlong(), true);
  });

  test('JSON hỏng → trả mặc định, không throw', () async {
    SharedPreferences.setMockInitialValues({'reader.settings': 'not-json', 'reader.pos.b1': '{bad'});
    final s2 = ReaderStore(await SharedPreferences.getInstance());
    expect(s2.readSettings().fontSize, 18);
    expect(s2.position('b1'), isNull);
  });
}
