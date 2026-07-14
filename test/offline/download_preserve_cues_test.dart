import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/offline_models.dart';
import 'package:novelverse/data/offline/download_manager.dart';

const _cueMap = {'s': 0, 'e': 1000, 'p': 0, 'cs': 0, 'ce': 5};

/// Fake repo 1 chương c1 có audio. `chapterText` MÔ PHỎNG hành vi repo thật:
/// auto-cache OfflineChapter (content + cues) vào store TRƯỚC rồi mới trả text
/// (thứ tự thật: chapterText → chapterContent → _fetchAndCache auto-cache).
class _Stories implements StoriesRepositoryLike {
  _Stories(this.store);
  final OfflineStore store;
  @override
  Future<StoryDetailData> detailData(String id) async => StoryDetailData(
      storyId: 's1', slug: 's1', title: 'S', cover: '', author: 'A', language: 'vi',
      synopsis: '', subtitle: '', status: 'ongoing', genre: '', trope: '',
      rating: '5', reads: '1', unlockPrice: 0, discountPercent: 0,
      chapters: const [ChapterMeta(chapterId: 'c1', n: 1, title: 'C1', state: 'free', hasAudio: true)]);
  @override
  Future<String> chapterText(String id) async {
    await store.saveChapter(OfflineChapter(
        chapterId: id, storyId: 's1', n: 1, title: 'C1', content: 'TEXT',
        hasAudio: true, cues: const [_cueMap]));
    return 'TEXT';
  }
}

class _Audio implements AudioUrlResolver {
  @override
  Future<String?> chapterAudioUrl(String id, {String? variantId}) async => 'http://x/$id.mp3';
}

void main() {
  late Directory tmp; late OfflineStore store; late DownloadManager dm;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('dpc_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
        downloads: await Hive.openBox('downloads'),
        chapters: await Hive.openBox('chapters'),
        storyMeta: await Hive.openBox('storyMeta'),
        files: FileStore(tmp));
    dm = DownloadManager(_Stories(store), _Audio(), store,
        downloader: (url, s, c) async => 500, nowMs: () => 123);
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('downloadStory không làm mất cues (textWorker ghi đè + audio copyWith)', () async {
    await dm.downloadStory('s1');
    final c = store.readChapter('c1')!;
    expect(c.content, 'TEXT');
    expect(c.audioFile, 'c1.mp3');
    expect(c.cues, hasLength(1));
    expect(c.cues.first['e'], 1000);
  });

  test('autoCacheAudio giữ content + cues sẵn có', () async {
    await store.saveChapter(const OfflineChapter(
        chapterId: 'c2', storyId: 's1', n: 2, title: 'C2', content: 'TXT',
        hasAudio: true, cues: [_cueMap]));
    await dm.autoCacheAudio(
        storyId: 's1', slug: 's1', title: 'S', cover: '', author: 'A',
        language: 'vi', chapterId: 'c2', n: 2, chapterTitle: 'C2',
        audioUrl: 'http://x/c2.mp3', nowMs: 5);
    final c = store.readChapter('c2')!;
    expect(c.audioFile, 'c2.mp3');
    expect(c.content, 'TXT');
    expect(c.cues, hasLength(1));
  });
}
