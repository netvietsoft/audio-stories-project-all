import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/download_manager.dart';

class _Stories implements StoriesRepositoryLike {
  @override Future<StoryDetailData> detailData(String id) async => throw UnimplementedError();
  @override Future<String> chapterText(String id) async => throw UnimplementedError();
}
class _Audio implements AudioUrlResolver {
  @override Future<String?> chapterAudioUrl(String id, {String? variantId}) async => null;
}

void main() {
  late Directory tmp; late OfflineStore store; late DownloadManager dm;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('ac_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
      downloads: await Hive.openBox('downloads'),
      chapters: await Hive.openBox('chapters'),
      storyMeta: await Hive.openBox('storyMeta'),
      files: FileStore(tmp));
    dm = DownloadManager(_Stories(), _Audio(), store, downloader: (u, s, c) async => 700, nowMs: () => 5);
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('autoCacheAudio lưu file + tạo record auto', () async {
    await dm.autoCacheAudio(storyId: 's1', slug: 's1', title: 'S', cover: '', author: 'A',
      language: 'vi', chapterId: 'c1', n: 1, chapterTitle: 'C1', audioUrl: 'http://x/c1.mp3', nowMs: 5);
    expect(store.readChapter('c1')!.audioFile, 'c1.mp3');
    expect(store.readChapter('c1')!.hasAudio, true);
    final r = store.download('s1')!;
    expect(r.kind, 'auto');
    expect(r.bytesAudio, 700);
  });
}
