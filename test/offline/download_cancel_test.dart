import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/download_manager.dart';

class _Stories implements StoriesRepositoryLike {
  @override
  Future<StoryDetailData> detailData(String id) async => StoryDetailData(
        storyId: 's1', slug: 's1', title: 'S', cover: '', author: 'A', language: 'vi',
        synopsis: '', subtitle: '', status: 'ongoing', genre: '', trope: '',
        rating: '5', reads: '1', unlockPrice: 0, discountPercent: 0,
        chapters: const [
          ChapterMeta(chapterId: 'c1', n: 1, title: 'C1', state: 'free', hasAudio: true),
          ChapterMeta(chapterId: 'c2', n: 2, title: 'C2', state: 'free', hasAudio: true),
        ],
      );
  @override
  Future<String> chapterText(String id) async => 'text-$id';
}

class _Audio implements AudioUrlResolver {
  @override
  Future<String?> chapterAudioUrl(String id, {String? variantId}) async => 'http://x/$id.mp3';
}

void main() {
  late Directory tmp;
  late OfflineStore store;

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('cancel_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
      downloads: await Hive.openBox('downloads'),
      chapters: await Hive.openBox('chapters'),
      storyMeta: await Hive.openBox('storyMeta'),
      files: FileStore(tmp),
    );
  });

  tearDown(() async {
    await Hive.close();
    await tmp.delete(recursive: true);
  });

  test('Xoá giữa lúc tải audio nền → huỷ, không hồi sinh data; tải lại = session mới', () async {
    final started = Completer<void>(); // báo audio đã bắt đầu tải (text đã xong)
    final release = Completer<void>(); // giữ audio download đến khi test cho phép

    final dm = DownloadManager(_Stories(), _Audio(), store,
        downloader: (u, s, c) async {
      if (!started.isCompleted) started.complete();
      await release.future;
      return 100;
    }, nowMs: () => 1);

    final fut = dm.downloadStory('s1');
    await started.future; // text xong, audio đang tải nền

    expect(dm.isDownloading('s1'), true);
    expect(store.download('s1'), isNotNull);         // record đã tạo (text complete)
    expect(store.readChapter('c1')!.content, 'text-c1'); // text đã về

    // User bấm Xoá: huỷ + xoá data.
    dm.cancel('s1');
    await store.deleteStory('s1');

    release.complete();  // audio in-flight kết thúc
    await fut;           // downloadStory dừng hẳn

    // KHÔNG hồi sinh: record + chương đã bị xoá và không được ghi lại.
    expect(store.download('s1'), isNull);
    expect(store.readChapter('c1'), isNull);

    // Tải lại = session mới, chạy được (không bị guard chặn).
    await dm.downloadStory('s1');
    final rec = store.download('s1');
    expect(rec, isNotNull);
    expect(rec!.status, 'complete');
    expect(store.readChapter('c1')!.content, 'text-c1');
  });
}
