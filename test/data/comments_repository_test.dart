import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/repositories/comments_repository.dart';

/// ApiClient giả: trả response cố định, ghi lại path/query/body.
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
    return response;
  }
}

const _cmt = {
  'id': 'c1', 'content': 'Hay quá', 'createdAt': '2026-07-15T10:00:00.000Z', 'likesCount': 2,
  'paragraphIndex': 3, 'paragraphAnchor': 'hay qua doan nay',
  'user': {'id': 'u1', 'displayName': 'Tí', 'avatarUrl': null},
  'reactions': {'helpful': 2, 'like': 1, 'love': 0}, 'repliesCount': 4,
};

void main() {
  test('paragraphAll: shape THẬT {data:{comments:[...]},meta} — đúng path + query, parse đủ field', () async {
    final api = _FakeApi({'data': {'comments': [_cmt]}, 'meta': {'total': 1}});
    final repo = CommentsRepository(api);
    final list = await repo.paragraphAll('ch1');
    expect(api.lastPath, '/chapters/ch1/comments');
    expect(api.lastQuery?['scope'], 'paragraph');
    expect(api.lastQuery?['allParagraphs'], 'true');
    final c = list.single;
    expect(c.id, 'c1');
    expect(c.paragraphIndex, 3);
    expect(c.paragraphAnchor, 'hay qua doan nay');
    expect(c.userName, 'Tí');
    expect(c.avatarUrl, isNull);
    expect(c.reactions['helpful'], 2);
    expect(c.repliesCount, 4);
  });

  test('paragraphAll: fallback shape phẳng cũ {data:[...]} vẫn parse được (tolerant)', () async {
    final api = _FakeApi({'data': [_cmt], 'meta': {'total': 1}});
    final repo = CommentsRepository(api);
    final list = await repo.paragraphAll('ch1');
    expect(list.single.id, 'c1');
  });

  test('chapterPage: shape THẬT {data:{comments:[...]},meta} — meta phân trang + comment cấp chương (paragraphIndex null)', () async {
    final api = _FakeApi({
      'data': {'comments': [{..._cmt, 'paragraphIndex': null, 'paragraphAnchor': null, 'reactions': null}]},
      'meta': {'page': 2, 'lastPage': 5, 'total': 99},
    });
    final repo = CommentsRepository(api);
    final pageData = await repo.chapterPage('ch1', page: 2, sort: 'helpful');
    expect(api.lastQuery?['scope'], 'chapter');
    expect(api.lastQuery?['sort'], 'helpful');
    expect(pageData.page, 2);
    expect(pageData.lastPage, 5);
    expect(pageData.hasMore, isTrue);
    expect(pageData.items.single.paragraphIndex, isNull);
    expect(pageData.items.single.reactions, {'helpful': 0, 'like': 0, 'love': 0}); // reactions null → 0 hết
  });

  test('replies: shape THẬT {data:{replies:[...]},meta} — đúng path + parse', () async {
    final api = _FakeApi({'data': {'replies': [_cmt]}, 'meta': {'page': 1, 'lastPage': 1, 'total': 1}});
    final repo = CommentsRepository(api);
    final p = await repo.replies('c1');
    expect(api.lastPath, '/comments/c1/replies');
    expect(p.items.single.id, 'c1');
    expect(p.total, 1);
  });

  test('create: double-wrap {data:comment} (sau ApiClient bóc 1 lớp) — gửi đủ body + parse đúng', () async {
    final api = _FakeApi({'data': _cmt});
    final repo = CommentsRepository(api);
    final created = await repo.create('ch1', content: 'hi', parentId: 'p1', scope: 'paragraph', paragraphIndex: 2, paragraphAnchor: 'abc');
    expect(api.lastPath, '/chapters/ch1/comments');
    expect(api.lastBody, {'content': 'hi', 'parentId': 'p1', 'scope': 'paragraph', 'paragraphIndex': 2, 'paragraphAnchor': 'abc'});
    expect(created.id, 'c1');
  });

  test('toggleReaction: double-wrap {data:{...reactions}} — đọc reactions mới', () async {
    final api = _FakeApi({'data': {'commentId': 'c1', 'toggledOn': true, 'type': 'love', 'reactions': {'helpful': 0, 'like': 1, 'love': 7}}});
    final repo = CommentsRepository(api);
    final r = await repo.toggleReaction('c1', 'love');
    expect(api.lastPath, '/comments/c1/reactions');
    expect(api.lastBody, {'type': 'love'});
    expect(r['love'], 7);
  });

  test('report: đúng path + body', () async {
    final api = _FakeApi(const {});
    final repo = CommentsRepository(api);
    await repo.report('c1', 'spam');
    expect(api.lastPath, '/comments/c1/report');
    expect(api.lastBody, {'reason': 'spam'});
  });
}
