import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/offline_models.dart';
import 'package:novelverse/data/offline/connectivity_service.dart';
import 'package:novelverse/data/repositories/stories_repository.dart';

void main() {
  late Directory tmp; late OfflineStore store; late ConnectivityService conn;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('repo_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
      downloads: await Hive.openBox('downloads'),
      chapters: await Hive.openBox('chapters'),
      storyMeta: await Hive.openBox('storyMeta'),
      files: FileStore(tmp));
    conn = ConnectivityService()..setOnline(false);
    await store.saveChapter(const OfflineChapter(
      chapterId: 'c1', storyId: 's1', n: 1, title: 't', content: 'LOCAL', hasAudio: false));
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('offline + có local → trả text local, không cần API', () async {
    // ApiClient với baseUrl không tồn tại: nếu gọi mạng sẽ ném; test đảm bảo KHÔNG gọi.
    final repo = StoriesRepository(ApiClient(), null, store, conn);
    final c = await repo.chapterContent('c1');
    expect(c.content, 'LOCAL');
  });
}
