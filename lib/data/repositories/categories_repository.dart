import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';
import '../../models/models.dart';
import '../cache/json_cache.dart';
import '../mappers/category_mapper.dart';

/// Thể loại truyện — CÙNG nguồn với web FE: `GET /stories/categories?language=`.
/// Có cache local để app hiện category ngay + đồng nhất với web.
class CategoriesRepository {
  CategoriesRepository(this._api, [this._cache]);
  final ApiClient _api;
  final JsonCache? _cache;

  Future<List<Category>> getCategories({String lang = 'vi'}) async {
    final data = await _api.get(ApiEndpoints.storiesCategories, query: {'language': lang});
    final list = unwrapList(data);
    _cache?.writeList('cache.categories.$lang', list);
    return list
        .whereType<Map>()
        .map((j) => CategoryMapper.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }

  /// Category từ cache local (đồng bộ). Null nếu chưa có.
  List<Category>? cached({String lang = 'vi'}) {
    final c = _cache?.readList('cache.categories.$lang');
    if (c == null) return null;
    return c.data
        .whereType<Map>()
        .map((j) => CategoryMapper.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }

  /// `GET /stories/categories/top` — thể loại nhiều truyện nhất (BE cache 1h).
  /// Dùng làm tiêu đề 3 kệ chủ đề ở Novel Home.
  Future<List<Category>> topCategories({int limit = 3, String lang = 'vi'}) async {
    final data = await _api.get(ApiEndpoints.storiesCategoriesTop, query: {'limit': limit, 'lang': lang});
    final list = unwrapList(data);
    _cache?.writeList('cache.home.topcats.$lang', list);
    return list
        .whereType<Map>()
        .map((j) => CategoryMapper.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }

  /// Bản cache local của [topCategories] (đồng bộ). Null nếu chưa có.
  List<Category>? cachedTopCategories({String lang = 'vi'}) {
    final c = _cache?.readList('cache.home.topcats.$lang');
    if (c == null) return null;
    return c.data
        .whereType<Map>()
        .map((j) => CategoryMapper.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }
}
