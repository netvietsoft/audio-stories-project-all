import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/repositories/banners_repository.dart';
import 'package:novelverse/data/repositories/history_repository.dart';

class _FakeApi extends ApiClient {
  _FakeApi(this.response);
  final dynamic response;
  String? lastPath;
  Map<String, dynamic>? lastQuery;
  Object? lastBody;
  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query, bool raw = false}) async {
    lastPath = path; lastQuery = query;
    return response;
  }
  @override
  Future<dynamic> post(String path, {Object? body}) async {
    lastPath = path; lastBody = body;
    return const {};
  }
}

void main() {
  test('banners: đúng path/query + parse HeroBanner (targetUrl/story.slug null OK)', () async {
    // Shape sau khi ApiClient bóc 1 lớp envelope: {data:[...]} → unwrapList bóc tiếp.
    final api = _FakeApi({
      'data': [
        {
          'id': 'b7f3a1c2-0d4e-4f5a-9b6c-1234567890ab',
          'title': 'Sự kiện',
          'subtitle': 'Đọc ngay',
          'imageUrl': 'https://x/b.jpg',
          'targetUrl': 'https://dreamtap.me/story/tien-nghich',
          'storyId': 'uuid-story-1',
          'order': 0,
          'isActive': true,
          'story': {'id': 'uuid-story-1', 'slug': 'tien-nghich', 'title': 'Tiên Nghịch'},
        },
        {
          'id': 'c8e4b2d3-1e5f-4a6b-8c7d-abcdef123456',
          'title': 'Trống link',
          'subtitle': null,
          'imageUrl': 'https://x/c.jpg',
          'targetUrl': '',
          'storyId': null,
          'order': 1,
          'isActive': true,
          'story': null,
        },
      ],
    });
    final repo = BannersRepository(api);
    final list = await repo.list();
    expect(api.lastPath, '/banners');
    expect(api.lastQuery, {'lang': 'vi'});
    expect(api.lastQuery?.containsKey('position'), isFalse);
    expect(list, hasLength(2));
    expect(list.first.id, 'b7f3a1c2-0d4e-4f5a-9b6c-1234567890ab');
    expect(list.first.targetUrl, contains('/story/'));
    expect(list.first.storySlug, 'tien-nghich');
    expect(list.last.targetUrl, isNull);
    expect(list.last.storySlug, isNull);
  });

  test('history sync: đúng path + body', () async {
    final api = _FakeApi(const {});
    final repo = HistoryRepository(api);
    await repo.sync(storyUuid: 'uuid-1', chapterId: 'ch-1');
    expect(api.lastPath, '/history/sync');
    expect(api.lastBody, {'storyId': 'uuid-1', 'chapterId': 'ch-1', 'progressSeconds': 0});
  });

  test('history list: parse story + chapterNumber + lastListenedAt', () async {
    final api = _FakeApi({
      'data': [
        {
          'lastListenedAt': '2026-07-17T04:00:00.000Z',
          'story': {'id': 'uuid-1', 'slug': 'tien-nghich', 'title': 'Tiên Nghịch', 'thumbnailUrl': 'https://x/t.jpg', 'totalViews': 1234},
          'chapter': {'id': 'ch-9', 'chapterNumber': 9, 'title': 'Chương 9'},
        }
      ],
      'meta': {'total': 1},
    });
    final repo = HistoryRepository(api);
    final rows = await repo.list();
    expect(api.lastPath, '/history');
    expect(api.lastQuery?['limit'], 50);
    final r = rows.single;
    expect(r.slug, 'tien-nghich');
    expect(r.storyUuid, 'uuid-1');
    expect(r.chapterNumber, 9);
    expect(r.lastListenedAtMs, DateTime.parse('2026-07-17T04:00:00.000Z').millisecondsSinceEpoch);
  });
}
