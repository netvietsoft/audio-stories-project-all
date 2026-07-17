import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';

/// 1 dòng lịch sử đọc/nghe từ BE (`GET /history` — kèm story + chapter).
class RemoteHistoryEntry {
  const RemoteHistoryEntry({
    required this.storyUuid,
    required this.slug,
    required this.title,
    required this.cover,
    required this.reads,
    required this.chapterNumber,
    required this.lastListenedAtMs,
  });
  final String storyUuid, slug, title, cover, reads;
  final int chapterNumber, lastListenedAtMs;

  factory RemoteHistoryEntry.fromJson(Map<String, dynamic> j) {
    final s = j['story'];
    final c = j['chapter'];
    final t = DateTime.tryParse((j['lastListenedAt'] ?? '').toString());
    num? views = s is Map && s['totalViews'] is num ? s['totalViews'] as num : null;
    return RemoteHistoryEntry(
      storyUuid: ((s is Map ? s['id'] : null) ?? '').toString(),
      slug: ((s is Map ? s['slug'] : null) ?? '').toString(),
      title: ((s is Map ? s['title'] : null) ?? '').toString(),
      cover: ((s is Map ? s['thumbnailUrl'] : null) ?? '').toString(),
      reads: views == null ? '' : '${views.toInt()}',
      chapterNumber: (c is Map && c['chapterNumber'] is num) ? (c['chapterNumber'] as num).toInt() : 1,
      lastListenedAtMs: t?.millisecondsSinceEpoch ?? 0,
    );
  }
}

/// Sync lịch sử đọc với BE (CHỈ khi đã đăng nhập — Bearer tự gắn).
class HistoryRepository {
  HistoryRepository(this._api);
  final ApiClient _api;

  /// Đẩy tiến độ 1 chương lên BE (fire-and-forget từ reader).
  Future<void> sync({required String storyUuid, required String chapterId, int progressSeconds = 0}) =>
      _api.post(ApiEndpoints.historySync, body: {
        'storyId': storyUuid,
        'chapterId': chapterId,
        'progressSeconds': progressSeconds,
      });

  /// Kéo lịch sử từ BE (sort mới nhất trước).
  Future<List<RemoteHistoryEntry>> list({int limit = 50}) async {
    final body = await _api.get(ApiEndpoints.history, raw: true, query: {'limit': limit});
    return unwrapList(body)
        .whereType<Map>()
        .map((j) => RemoteHistoryEntry.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }
}
