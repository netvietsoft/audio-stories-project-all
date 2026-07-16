import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/offline/connectivity_service.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_models.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/repositories/stories_repository.dart';
import 'package:novelverse/models/models.dart';

/// Adapter Dio giả trả JSON cố định — dùng để lái path online THẬT của
/// chapterContent (test H2) mà không cần server thật.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.body);
  final Map<String, dynamic> body;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    return ResponseBody.fromString(
      jsonEncode({'data': body}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  late Directory tmp;
  late OfflineStore store;

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('detail_offline_test');
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

  test('B1: offline + downloaded → detail() dựng từ local meta, KHÔNG gọi API', () async {
    await store.saveStoryMeta(const OfflineStoryMeta(
      storyId: 's1', synopsis: 'syn', cover: 'cover.png', author: 'Author A',
      subtitle: 'sub', status: 'Ongoing', genre: 'Romance', trope: 'Revenge',
      rating: '4.9', reads: '2M', unlockPrice: 0, discountPercent: 0,
      totalChapters: 2,
      chapters: [
        {'chapterId': 'c1', 'n': 1, 'title': 'Chapter 1', 'state': 'free', 'hasAudio': false},
        {'chapterId': 'c2', 'n': 2, 'title': 'Chapter 2', 'state': 'vip', 'hasAudio': true},
      ],
    ));
    await store.upsertDownload(DownloadRecord(
      storyId: 's1', slug: 's1', title: 'My Story', cover: 'cover.png', author: 'Author A',
      language: 'vi', kind: 'downloaded', status: 'complete', totalChapters: 2, savedChapters: 2,
      bytesText: 10, bytesAudio: 10, createdAt: 1, lastAccessAt: 1));

    final conn = ConnectivityService()..setOnline(false);
    // ApiClient() dùng baseUrl dev mặc định (không có server thật trong test) —
    // nếu code lỡ gọi mạng sẽ ném lỗi; test pass chứng minh KHÔNG gọi API.
    final repo = StoriesRepository(ApiClient(), null, store, conn);

    final detail = await repo.detail('s1');
    expect(detail.book.title, 'My Story');
    expect(detail.book.author, 'Author A');
    expect(detail.book.genre, 'Romance');
    expect(detail.chapters.length, 2);
    expect(detail.chapters[0].id, 'c1');
    expect(detail.chapters[0].state, ChapterState.free);
    expect(detail.chapters[1].id, 'c2');
    expect(detail.chapters[1].state, ChapterState.vip);
    expect(detail.chapters[1].hasAudio, true);
    expect(detail.book.uuid, isNull); // meta cũ chưa có uuid → degrade cũ (Support báo 'chưa đồng bộ')
  });

  test('H2: auto-cache text lúc online không xoá audioFile đã lưu trước đó', () async {
    await store.saveChapter(const OfflineChapter(
      chapterId: 'c1', storyId: 's1', n: 1, title: 'Chapter 1', content: 'OLD',
      hasAudio: true, audioFile: 'c1.mp3'));

    final dio = Dio(BaseOptions(baseUrl: 'http://fake'))
      ..httpClientAdapter = _FakeAdapter({
        'id': 'c1', 'chapterNumber': 1, 'title': 'Chapter 1', 'content': 'FROM_API', 'storyId': 's1',
      });
    final repo = StoriesRepository(ApiClient(dio), null, store, null);

    final content = await repo.chapterContent('c1');
    expect(content.content, 'FROM_API');

    final saved = store.readChapter('c1')!;
    expect(saved.content, 'FROM_API');
    expect(saved.audioFile, 'c1.mp3'); // audio KHÔNG bị mất bởi auto-cache text
    expect(saved.hasAudio, true);
  });
}
