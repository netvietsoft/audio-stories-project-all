import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';

/// 1 banner hero (bảng HeroBanner — admin quản, BE lọc isActive, sort order asc,
/// title/subtitle đã localize theo `?lang`).
class AppBanner {
  const AppBanner({
    required this.id,
    required this.title,
    required this.imageUrl,
    required this.targetUrl,
    required this.storySlug,
  });
  final String id;
  final String title, imageUrl;
  /// URL đích (web) — rỗng/null → null.
  final String? targetUrl;
  /// `story.slug` nếu banner gắn truyện → mở in-app.
  final String? storySlug;

  factory AppBanner.fromJson(Map<String, dynamic> j) {
    final story = j['story'];
    final target = (j['targetUrl'] ?? '').toString();
    final slug = (story is Map ? (story['slug'] ?? '') : '').toString();
    return AppBanner(
      id: (j['id'] ?? '').toString(),
      title: (j['title'] ?? '').toString(),
      imageUrl: (j['imageUrl'] ?? '').toString(),
      targetUrl: target.isEmpty ? null : target,
      storySlug: slug.isEmpty ? null : slug,
    );
  }
}

/// Banner hero trang chủ — `GET /banners?lang=` (public; BE tự lọc isActive, sort order asc).
class BannersRepository {
  BannersRepository(this._api);
  final ApiClient _api;

  Future<List<AppBanner>> list({String lang = 'vi'}) async {
    final data = await _api.get(ApiEndpoints.banners, query: {'lang': lang});
    return unwrapList(data)
        .whereType<Map>()
        .map((j) => AppBanner.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }
}
