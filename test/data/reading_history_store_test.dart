import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/reading_history/reading_history_store.dart';
import 'package:novelverse/data/repositories/history_repository.dart';

ReadingHistoryEntry _e(String id, int chapter, int savedAt) => ReadingHistoryEntry(
    bookId: id, storyUuid: 'u-$id', title: 'T$id', cover: '', synopsis: 'tóm tắt dài',
    genre: 'Tiên hiệp', reads: '1K', totalChapters: 100, chapter: chapter, savedAt: savedAt);

void main() {
  late Directory tmp; late ReadingHistoryStore store;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('rh_test');
    Hive.init('${tmp.path}/hive');
    store = ReadingHistoryStore(await Hive.openBox('readingHistory'));
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('record upsert theo bookId + entries sort savedAt desc', () async {
    await store.record(_e('a', 1, 100));
    await store.record(_e('b', 2, 200));
    await store.record(_e('a', 5, 300)); // update a
    final list = store.entries();
    expect(list.map((x) => x.bookId), ['a', 'b']);
    expect(list.first.chapter, 5);
  });

  test('giới hạn 50 — xoá cũ nhất', () async {
    for (var i = 0; i < 55; i++) {
      await store.record(_e('b$i', 1, i));
    }
    final list = store.entries();
    expect(list, hasLength(50));
    expect(list.any((x) => x.bookId == 'b0'), isFalse); // cũ nhất bị xoá
    expect(list.first.bookId, 'b54');
  });

  test('truncateWords: 20 từ + … ; ngắn giữ nguyên; whitespace thừa không tạo từ rỗng', () {
    final long = List.generate(30, (i) => 'từ$i').join(' ');
    final out = truncateWords(long, 20);
    expect(out.endsWith('…'), isTrue);
    expect(out.split(' '), hasLength(20)); // 20 từ (từ cuối dính '…')
    expect(truncateWords('ngắn thôi', 20), 'ngắn thôi');
    expect(truncateWords('a   b\n\nc', 2), 'a b…');
  });

  test('mergeHistory: remote mới hơn thắng, local mới hơn giữ, remote-only thêm mới', () {
    final local = [_e('a', 3, 1000), _e('b', 7, 5000)];
    final remote = [
      RemoteHistoryEntry(storyUuid: 'u-a', slug: 'a', title: 'Ta', cover: 'c', reads: '9', chapterNumber: 4, lastListenedAtMs: 2000), // mới hơn local a
      RemoteHistoryEntry(storyUuid: 'u-b', slug: 'b', title: 'Tb', cover: 'c', reads: '9', chapterNumber: 1, lastListenedAtMs: 100),  // cũ hơn local b
      RemoteHistoryEntry(storyUuid: 'u-c', slug: 'c', title: 'Tc', cover: 'c', reads: '9', chapterNumber: 2, lastListenedAtMs: 3000), // chỉ có remote
    ];
    final merged = mergeHistory(local, remote);
    expect(merged.map((x) => x.bookId), ['b', 'c', 'a']); // sort savedAt desc: b(5000), c(3000), a(2000)
    expect(merged.firstWhere((x) => x.bookId == 'a').chapter, 4);
    expect(merged.firstWhere((x) => x.bookId == 'b').chapter, 7);
    expect(merged.firstWhere((x) => x.bookId == 'c').synopsis, '');
  });
}
