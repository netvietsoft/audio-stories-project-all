import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/offline_models.dart';
import 'package:novelverse/data/offline/connectivity_service.dart';
import 'package:novelverse/data/repositories/stories_repository.dart';

/// ApiClient giả: trả response cố định cho mọi GET, đếm số lần gọi.
/// (Kế thừa ApiClient thật nhưng override get → không chạm mạng.)
class _FakeApi extends ApiClient {
  _FakeApi(this.response);
  final Map<String, dynamic> response;
  int calls = 0;
  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query, bool raw = false}) async {
    calls++;
    return response;
  }
}

const _oldCue = {'s': 0, 'e': 1000, 'p': 0, 'cs': 0, 'ce': 5};
const _newCue = {'s': 0, 'e': 2000, 'p': 0, 'cs': 0, 'ce': 5};

Map<String, dynamic> _apiChapter({List<Map>? cues}) => {
      'id': 'c1', 'chapterNumber': 1, 'title': 'C1', 'content': 'HELLO SERVER',
      'storyId': 's1', if (cues != null) 'timing': {'v': 1, 'cues': cues},
    };

/// Đợi điều kiện của refresh nền fire-and-forget (poll tối đa ~1s).
Future<void> _waitFor(bool Function() done) async {
  for (var i = 0; i < 100 && !done(); i++) {
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

void main() {
  late Directory tmp; late OfflineStore store; late ConnectivityService conn;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('ra_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
        downloads: await Hive.openBox('downloads'),
        chapters: await Hive.openBox('chapters'),
        storyMeta: await Hive.openBox('storyMeta'),
        files: FileStore(tmp));
    conn = ConnectivityService();
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('offline + local có cues → trả TimingCue, KHÔNG gọi API', () async {
    conn.setOnline(false);
    await store.saveChapter(const OfflineChapter(
        chapterId: 'c1', storyId: 's1', n: 1, title: 'C1', content: 'LOCAL',
        hasAudio: true, cues: [_oldCue]));
    final api = _FakeApi(_apiChapter(cues: const [_newCue]));
    final repo = StoriesRepository(api, null, store, conn);

    final c = await repo.chapterContent('c1');

    expect(c.content, 'LOCAL');
    expect(c.cues, hasLength(1));
    expect(c.cues.first.endMs, 1000);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    expect(api.calls, 0); // offline → không refresh nền
  });

  test('online + truyện downloaded → trả local ngay, refresh nền cập nhật Hive', () async {
    conn.setOnline(true);
    await store.saveChapter(const OfflineChapter(
        chapterId: 'c1', storyId: 's1', n: 1, title: 'C1', content: 'LOCAL',
        hasAudio: true, cues: [_oldCue]));
    await store.upsertDownload(const DownloadRecord(
        storyId: 's1', slug: 's1', title: 'S', cover: '', author: 'A', language: 'vi',
        kind: 'downloaded', status: 'complete', totalChapters: 1, savedChapters: 1,
        bytesText: 5, bytesAudio: 0, createdAt: 1, lastAccessAt: 1));
    final api = _FakeApi(_apiChapter(cues: const [_newCue]));
    final repo = StoriesRepository(api, null, store, conn);

    final c = await repo.chapterContent('c1');
    expect(c.content, 'LOCAL');           // instant-open từ local
    expect(c.cues.first.endMs, 1000);     // cues cũ — bản mới hiệu lực lần mở sau

    await _waitFor(() => store.readChapter('c1')!.content == 'HELLO SERVER');
    final saved = store.readChapter('c1')!;
    expect(saved.content, 'HELLO SERVER');            // refresh cả content...
    expect(saved.cues.first['e'], 2000);              // ...lẫn cues, cùng 1 response
    expect(saved.hasAudio, true);                     // merge giữ hasAudio cũ
    expect(api.calls, 1);
  });

  test('online fetch thường → auto-cache lưu cues; response không timing → ghi []', () async {
    conn.setOnline(true);
    final api = _FakeApi(_apiChapter(cues: const [_newCue]));
    final repo = StoriesRepository(api, null, store, conn);

    final c = await repo.chapterContent('c1'); // không local → nhánh fetch
    expect(c.cues.first.endMs, 2000);
    expect(store.readChapter('c1')!.cues, hasLength(1)); // auto-cache đã lưu cues

    // Server gỡ timing → lần fetch sau ghi đè cues = [] (server là nguồn sự thật).
    // (KHÔNG có record 'downloaded' + đang online → vẫn đi nhánh fetch, không local-first.)
    final api2 = _FakeApi(_apiChapter());
    final repo2 = StoriesRepository(api2, null, store, conn);
    await repo2.chapterContent('c1');
    expect(store.readChapter('c1')!.cues, isEmpty);
  });
}
