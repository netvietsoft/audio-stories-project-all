import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/download_manager.dart';

// Fake repo trả 2 chương: c1 có audio, c2 không.
class FakeStories implements StoriesRepositoryLike {
  @override
  Future<StoryDetailData> detailData(String id) async => StoryDetailData(
      storyId: 's1', slug: 's1', title: 'S', cover: '', author: 'A', language: 'vi',
      synopsis: '', subtitle: '', status: 'ongoing', genre: '', trope: '',
      rating: '5', reads: '1', unlockPrice: 0, discountPercent: 0,
      chapters: const [
        ChapterMeta(chapterId: 'c1', n: 1, title: 'C1', state: 'free', hasAudio: true),
        ChapterMeta(chapterId: 'c2', n: 2, title: 'C2', state: 'free', hasAudio: false),
      ]);
  @override
  Future<String> chapterText(String id) async => 'text-$id';
}

class FakeAudio implements AudioUrlResolver {
  @override
  Future<String?> chapterAudioUrl(String id, {String? variantId}) async => 'http://x/$id.mp3';
}

void main() {
  late Directory tmp; late OfflineStore store; late DownloadManager dm;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('dm_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
        downloads: await Hive.openBox('downloads'),
        chapters: await Hive.openBox('chapters'),
        storyMeta: await Hive.openBox('storyMeta'),
        files: FileStore(tmp));
    dm = DownloadManager(FakeStories(), FakeAudio(), store,
        downloader: (url, s, c) async => 500, nowMs: () => 123);
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('downloadStory lưu đủ chương, chỉ tải audio chương hasAudio', () async {
    await dm.downloadStory('s1');
    expect(store.readChapter('c1')!.content, 'text-c1');
    expect(store.readChapter('c1')!.audioFile != null, true);   // c1 có audio
    expect(store.readChapter('c2')!.audioFile, null);           // c2 không
    final r = store.download('s1')!;
    expect(r.status, 'complete');
    expect(r.savedChapters, 2);
    expect(r.kind, 'downloaded');
    expect(r.bytesAudio, 500);
  });
}
