import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';

/// 1 banner quảng bá (admin quản, BE lọc isActive/start-end, sort orderIndex).
class AppBanner {
  const AppBanner({required this.id, required this.title, required this.imageUrl, required this.linkUrl});
  final int id;
  final String title, imageUrl;
  final String? linkUrl;

  factory AppBanner.fromJson(Map<String, dynamic> j) => AppBanner(
        id: j['id'] is num ? (j['id'] as num).toInt() : 0,
        title: (j['title'] ?? '').toString(),
        imageUrl: (j['imageUrl'] ?? '').toString(),
        linkUrl: (j['linkUrl'] as String?)?.isNotEmpty == true ? j['linkUrl'] as String : null,
      );
}

/// Banner Home (`GET /banners?position=home_hero`).
class BannersRepository {
  BannersRepository(this._api);
  final ApiClient _api;

  Future<List<AppBanner>> list({String position = 'home_hero'}) async {
    final data = await _api.get(ApiEndpoints.banners, query: {'position': position});
    return unwrapList(data)
        .whereType<Map>()
        .map((j) => AppBanner.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }
}
