import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/offline_models.dart';

void main() {
  late Directory tmp;
  late OfflineStore store;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('os_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
      downloads: await Hive.openBox('downloads'),
      chapters: await Hive.openBox('chapters'),
      storyMeta: await Hive.openBox('storyMeta'),
      files: FileStore(tmp),
    );
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('save/read chapter round-trip', () async {
    await store.saveChapter(const OfflineChapter(
      chapterId: 'c1', storyId: 's1', n: 1, title: 'Ch1', content: 'noi dung', hasAudio: true));
    expect(store.hasChapter('c1'), true);
    expect(store.readChapter('c1')!.content, 'noi dung');
  });

  test('upsert + list downloads, totalBytes theo kind', () async {
    await store.upsertDownload(DownloadRecord(
      storyId: 's1', slug: 'a', title: 'A', cover: '', author: '', language: 'vi',
      kind: 'downloaded', status: 'complete', totalChapters: 2, savedChapters: 2,
      bytesText: 100, bytesAudio: 900, createdAt: 1, lastAccessAt: 1));
    await store.upsertDownload(DownloadRecord(
      storyId: 's2', slug: 'b', title: 'B', cover: '', author: '', language: 'vi',
      kind: 'auto', status: 'complete', totalChapters: 1, savedChapters: 1,
      bytesText: 10, bytesAudio: 40, createdAt: 1, lastAccessAt: 1));
    expect(store.listDownloads().length, 2);
    expect(store.totalBytes('downloaded'), 1000);
    expect(store.totalBytes('auto'), 50);
  });

  test('deleteStory xoá record + chapter', () async {
    await store.upsertDownload(DownloadRecord(
      storyId: 's1', slug: 'a', title: 'A', cover: '', author: '', language: 'vi',
      kind: 'downloaded', status: 'complete', totalChapters: 1, savedChapters: 1,
      bytesText: 1, bytesAudio: 1, createdAt: 1, lastAccessAt: 1));
    await store.saveChapter(const OfflineChapter(
      chapterId: 'c1', storyId: 's1', n: 1, title: 'x', content: 'y', hasAudio: false));
    await store.deleteStory('s1');
    expect(store.download('s1'), null);
    expect(store.hasChapter('c1'), false);
  });
}
