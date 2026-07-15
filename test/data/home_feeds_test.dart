import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/repositories/categories_repository.dart';
import 'package:novelverse/data/repositories/stories_repository.dart';

/// ApiClient giả: trả response cố định, ghi lại path+query để assert.
class _FakeApi extends ApiClient {
  _FakeApi(this.response);
  final dynamic response;
  String? lastPath;
  Map<String, dynamic>? lastQuery;
  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query, bool raw = false}) async {
    lastPath = path;
    lastQuery = query;
    return response;
  }
}

const _story = {'id': 's1', 'slug': 's1', 'title': 'T', 'thumbnailUrl': ''};

void main() {
  test('recommended() gọi /stories/recommended + map Book', () async {
    final api = _FakeApi([_story]);
    final repo = StoriesRepository(api);
    final books = await repo.recommended(limit: 1, lang: 'vi');
    expect(api.lastPath, '/stories/recommended');
    expect(api.lastQuery?['limit'], 1);
    expect(api.lastQuery?['lang'], 'vi');
    expect(books, hasLength(1));
    expect(books.first.title, 'T');
  });

  test('trending() gọi /stories/trending với trendWindow=week (mặc định) + chịu được envelope', () async {
    final api = _FakeApi({'data': [_story], 'meta': {'total': 1}});
    final repo = StoriesRepository(api);
    final books = await repo.trending(lang: 'vi');
    expect(api.lastPath, '/stories/trending');
    expect(api.lastQuery?['limit'], 10);
    expect(api.lastQuery?['trendWindow'], 'week');
    expect(books, hasLength(1));
  });

  test('topCategories() gọi /stories/categories/top + map Category', () async {
    final api = _FakeApi([
      {'id': 3, 'name': 'Ngôn tình', 'slug': 'ngon-tinh'},
      {'id': 7, 'name': 'Kiếm hiệp', 'slug': 'kiem-hiep'},
    ]);
    final repo = CategoriesRepository(api);
    final cats = await repo.topCategories(limit: 3, lang: 'vi');
    expect(api.lastPath, '/stories/categories/top');
    expect(api.lastQuery?['limit'], 3);
    expect(cats, hasLength(2));
    expect(cats.first.id, 3);
    expect(cats.first.name, 'Ngôn tình');
  });
}
