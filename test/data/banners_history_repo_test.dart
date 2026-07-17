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
  test('banners: đúng path/query + parse (linkUrl null OK)', () async {
    final api = _FakeApi([
      {'id': 1, 'title': 'Sự kiện', 'imageUrl': 'https://x/b.jpg', 'linkUrl': 'https://dreamtap.me/story/tien-nghich'},
      {'id': 2, 'title': 'Trống link', 'imageUrl': 'https://x/c.jpg', 'linkUrl': null},
    ]);
    final repo = BannersRepository(api);
    final list = await repo.list();
    expect(api.lastPath, '/banners');
    expect(api.lastQuery?['position'], 'home_hero');
    expect(list, hasLength(2));
    expect(list.first.linkUrl, contains('/story/'));
    expect(list.last.linkUrl, isNull);
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
