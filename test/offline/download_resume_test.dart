import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/offline_models.dart';
import 'package:novelverse/data/offline/download_manager.dart';

/// Fake repo đếm số lần gọi chapterText để chứng minh resume KHÔNG tải lại
/// chương đã có text.
class _CountingStories implements StoriesRepositoryLike {
  _CountingStories(this.chapters);
  final List<ChapterMeta> chapters;
  final Map<String, int> textCalls = {};

  @override
  Future<StoryDetailData> detailData(String id) async => StoryDetailData(
        storyId: 's1', slug: 's1', title: 'S', cover: '', author: 'A', language: 'vi',
        synopsis: '', subtitle: '', status: 'ongoing', genre: '', trope: '',
        rating: '5', reads: '1', unlockPrice: 0, discountPercent: 0, chapters: chapters,
      );

  @override
  Future<String> chapterText(String id) async {
    textCalls[id] = (textCalls[id] ?? 0) + 1;
    return 'text-$id';
  }
}

class _CountingAudio implements AudioUrlResolver {
  int calls = 0;
  @override
  Future<String?> chapterAudioUrl(String id, {String? variantId}) async {
    calls++;
    return 'http://x/$id.mp3';
  }
}

void main() {
  late Directory tmp;
  late OfflineStore store;
  late _CountingStories stories;
  late _CountingAudio audio;
  var dlCalls = 0;

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('resume_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
      downloads: await Hive.openBox('downloads'),
      chapters: await Hive.openBox('chapters'),
      storyMeta: await Hive.openBox('storyMeta'),
      files: FileStore(tmp),
    );
    stories = _CountingStories(const [
      ChapterMeta(chapterId: 'c1', n: 1, title: 'C1', state: 'free', hasAudio: true),
      ChapterMeta(chapterId: 'c2', n: 2, title: 'C2', state: 'free', hasAudio: false),
    ]);
    audio = _CountingAudio();
    dlCalls = 0;
  });

  tearDown(() async {
    await Hive.close();
    await tmp.delete(recursive: true);
  });

  test('resume: bỏ qua chương đã có text + audio, chỉ tải phần thiếu', () async {
    // c1 đã tải xong text + audio từ trước.
    await store.saveChapter(const OfflineChapter(
        chapterId: 'c1', storyId: 's1', n: 1, title: 'C1',
        content: 'existing-c1', hasAudio: true, audioFile: 'c1.mp3'));

    final dm = DownloadManager(stories, audio, store,
        downloader: (u, s, c) async { dlCalls++; return 100; }, nowMs: () => 1);
    await dm.downloadStory('s1');

    // c1 KHÔNG bị tải lại (text đã có); c2 được tải.
    expect(stories.textCalls['c1'], isNull);
    expect(stories.textCalls['c2'], 1);
    // Audio: c1 đã có file → không resolve/tải; c2 không có audio → cũng không.
    expect(audio.calls, 0);
    expect(dlCalls, 0);

    // c1 giữ nguyên nội dung + audioFile; c2 có text mới.
    expect(store.readChapter('c1')!.content, 'existing-c1');
    expect(store.readChapter('c1')!.audioFile, 'c1.mp3');
    expect(store.readChapter('c2')!.content, 'text-c2');

    // Text đủ → record readable (savedChapters == total, complete).
    final rec = store.download('s1')!;
    expect(rec.savedChapters, 2);
    expect(rec.status, 'complete');
  });
}
