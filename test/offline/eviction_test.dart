import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/offline_models.dart';

DownloadRecord rec(String id, String kind, int bytes, int last) => DownloadRecord(
    storyId: id, slug: id, title: id, cover: '', author: '', language: 'vi',
    kind: kind, status: 'complete', totalChapters: 1, savedChapters: 1,
    bytesText: 0, bytesAudio: bytes, createdAt: 0, lastAccessAt: last);

void main() {
  late Directory tmp; late OfflineStore store;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('ev_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
      downloads: await Hive.openBox('downloads'),
      chapters: await Hive.openBox('chapters'),
      storyMeta: await Hive.openBox('storyMeta'),
      files: FileStore(tmp));
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('eviction xoá auto cũ nhất trước, giữ downloaded', () async {
    await store.upsertDownload(rec('old', 'auto', 100, 1));   // cũ nhất
    await store.upsertDownload(rec('new', 'auto', 100, 9));
    await store.upsertDownload(rec('keep', 'downloaded', 100, 0)); // không bị xoá
    await store.enforceAutoCacheLimit(150); // auto=200 > 150 → xoá 'old'
    expect(store.download('old'), null);
    expect(store.download('new') != null, true);
    expect(store.download('keep') != null, true);
    expect(store.totalBytes('auto') <= 150, true);
  });

  test('promoteToDownloaded bảo vệ khỏi eviction', () async {
    await store.upsertDownload(rec('s1', 'auto', 100, 1));
    await store.promoteToDownloaded('s1');
    expect(store.download('s1')!.kind, 'downloaded');
    await store.enforceAutoCacheLimit(0);
    expect(store.download('s1') != null, true); // downloaded → không xoá
  });
}
