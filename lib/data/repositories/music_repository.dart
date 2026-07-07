import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';
import '../../models/models.dart';
import '../cache/json_cache.dart';
import '../mappers/song_mapper.dart';

/// Truy xuất nhạc/audiobook từ backend. Ẩn chi tiết API/envelope khỏi UI.
class MusicRepository {
  MusicRepository(this._api, [this._cache]);
  final ApiClient _api;
  final JsonCache? _cache;

  static const _kList = 'cache.music.list';

  /// `GET /music` — trả `{data:{data:[row],meta}}`. Sau khi ApiClient bóc 1 lớp
  /// còn `{data:[row],meta}` → lấy list qua [unwrapList].
  Future<List<Song>> list({int page = 1, int limit = 30, String? search}) async {
    final inner = await _api.get(ApiEndpoints.music, query: {
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
    });
    final list = unwrapList(inner);
    if ((search == null || search.isEmpty) && page == 1) {
      _cache?.writeList(_kList, list);
    }
    return list
        .whereType<Map>()
        .map((j) => SongMapper.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }

  /// Đọc danh sách nhạc từ cache local (đồng bộ). Null nếu chưa có.
  ({List<Song> songs, Duration age})? cachedList() {
    final c = _cache?.readList(_kList);
    if (c == null) return null;
    final songs = c.data
        .whereType<Map>()
        .map((j) => SongMapper.fromJson(Map<String, dynamic>.from(j)))
        .toList();
    return (songs: songs, age: c.age);
  }
}
