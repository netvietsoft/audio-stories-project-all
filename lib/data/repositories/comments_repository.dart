import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';

/// 1 bình luận chương/đoạn (shape serializeComment của BE chapter-comments).
class ChapterComment {
  const ChapterComment({
    required this.id,
    required this.content,
    required this.createdAt,
    required this.paragraphIndex,
    required this.paragraphAnchor,
    required this.userName,
    required this.avatarUrl,
    required this.reactions,
    required this.repliesCount,
  });

  final String id, content, createdAt, userName;
  final String? avatarUrl, paragraphAnchor;
  /// null = comment cấp CHƯƠNG.
  final int? paragraphIndex;
  /// helpful/like/love → count.
  final Map<String, int> reactions;
  final int repliesCount;

  factory ChapterComment.fromJson(Map<String, dynamic> j) {
    final u = j['user'];
    final r = j['reactions'];
    return ChapterComment(
      id: (j['id'] ?? '').toString(),
      content: (j['content'] ?? '').toString(),
      createdAt: (j['createdAt'] ?? '').toString(),
      paragraphIndex: j['paragraphIndex'] is num ? (j['paragraphIndex'] as num).toInt() : null,
      paragraphAnchor: j['paragraphAnchor']?.toString(),
      userName: ((u is Map ? u['displayName'] : null) ?? 'Độc giả').toString(),
      avatarUrl: (u is Map ? u['avatarUrl'] : null)?.toString(),
      reactions: {
        for (final k in const ['helpful', 'like', 'love'])
          k: (r is Map && r[k] is num) ? (r[k] as num).toInt() : 0,
      },
      repliesCount: j['repliesCount'] is num ? (j['repliesCount'] as num).toInt() : 0,
    );
  }

  /// Bản copy với reactions mới (sau toggle).
  ChapterComment withReactions(Map<String, int> r) => ChapterComment(
        id: id, content: content, createdAt: createdAt,
        paragraphIndex: paragraphIndex, paragraphAnchor: paragraphAnchor,
        userName: userName, avatarUrl: avatarUrl,
        reactions: r, repliesCount: repliesCount,
      );
}

/// Trang comment + meta phân trang.
class CommentPage {
  const CommentPage({required this.items, required this.page, required this.lastPage, required this.total});
  final List<ChapterComment> items;
  final int page, lastPage, total;
  bool get hasMore => page < lastPage;
}

/// Bình luận chương/đoạn + replies + reactions (module chapter-comments BE).
class CommentsRepository {
  CommentsRepository(this._api);
  final ApiClient _api;

  /// TẤT CẢ comment cấp đoạn của 1 chương (allParagraphs=true → BE bỏ phân trang).
  Future<List<ChapterComment>> paragraphAll(String chapterId) async {
    final body = await _api.get(ApiEndpoints.chapterComments(chapterId), raw: true,
        query: {'scope': 'paragraph', 'allParagraphs': 'true'});
    return _extractList(body, 'comments')
        .whereType<Map>()
        .map((j) => ChapterComment.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }

  /// Comment cấp CHƯƠNG, phân trang. sort: newest | helpful.
  Future<CommentPage> chapterPage(String chapterId, {int page = 1, int limit = 20, String sort = 'newest'}) async {
    final body = await _api.get(ApiEndpoints.chapterComments(chapterId), raw: true,
        query: {'scope': 'chapter', 'page': page, 'limit': limit, 'sort': sort});
    return _page(body, 'comments', page);
  }

  /// Replies của 1 comment, phân trang.
  Future<CommentPage> replies(String commentId, {int page = 1, int limit = 20}) async {
    final body = await _api.get(ApiEndpoints.commentReplies(commentId), raw: true,
        query: {'page': page, 'limit': limit});
    return _page(body, 'replies', page);
  }

  /// Đăng comment/reply (cần đăng nhập — Bearer tự gắn). Trả comment vừa tạo.
  ///
  /// BE service trả `{data: comment}` KHÔNG kèm `meta` → interceptor bọc thêm 1
  /// lớp `data` (thấy chưa đủ `{data,meta}`) → sau khi `ApiClient.post` bóc 1
  /// lớp, repo còn nhận `{data: comment}` → bóc thêm 1 lớp nữa nếu có.
  Future<ChapterComment> create(String chapterId, {
    required String content,
    String? parentId,
    String scope = 'chapter',
    int? paragraphIndex,
    String? paragraphAnchor,
  }) async {
    final res = await _api.post(ApiEndpoints.chapterComments(chapterId), body: {
      'content': content,
      'parentId': ?parentId,
      'scope': scope,
      'paragraphIndex': ?paragraphIndex,
      'paragraphAnchor': ?paragraphAnchor,
    });
    final data = (res is Map && res['data'] is Map) ? res['data'] : res;
    return ChapterComment.fromJson(Map<String, dynamic>.from(data as Map));
  }

  /// Toggle reaction (helpful|like|love). BE trả reactions MỚI → dùng luôn.
  /// Cùng double-wrap như [create] → bóc 1 lớp `data` nếu có trước khi đọc.
  Future<Map<String, int>> toggleReaction(String commentId, String type) async {
    final res = await _api.post(ApiEndpoints.commentReactions(commentId), body: {'type': type});
    final data = (res is Map && res['data'] is Map) ? res['data'] : res;
    final m = data is Map ? data : const {};
    final r = m['reactions'] is Map ? m['reactions'] as Map : m;
    return {
      for (final k in const ['helpful', 'like', 'love'])
        k: (r[k] is num) ? (r[k] as num).toInt() : 0,
    };
  }

  /// Báo cáo comment (cần đăng nhập).
  Future<void> report(String commentId, String reason) =>
      _api.post(ApiEndpoints.commentReport(commentId), body: {'reason': reason});

  CommentPage _page(dynamic body, String key, int fallbackPage) {
    final list = _extractList(body, key);
    final meta = _topMeta(body);
    int i(dynamic v, int d) => v is num ? v.toInt() : d;
    return CommentPage(
      items: list.whereType<Map>().map((j) => ChapterComment.fromJson(Map<String, dynamic>.from(j))).toList(),
      page: i(meta?['page'], fallbackPage),
      lastPage: i(meta?['lastPage'], fallbackPage),
      total: i(meta?['total'], list.length),
    );
  }
}

/// Lấy MẢNG comment từ body RAW `{data:{[key]:[...]}, meta}` (shape thật BE
/// chapter-comments) — bóc dần các lớp `data`, ở mỗi tầng: gặp Map có [key] là
/// List → trả nó; gặp List → trả luôn (fallback shape phẳng cũ `{data:[...]}`).
List<dynamic> _extractList(dynamic body, String key) {
  var x = body;
  var guard = 0;
  while (guard < 4) {
    if (x is Map && x[key] is List) return x[key] as List;
    if (x is List) return x;
    if (x is Map && x.containsKey('data')) {
      x = x['data'];
      guard++;
    } else {
      break;
    }
  }
  return const [];
}

/// Đọc `meta` phân trang ở TOP-LEVEL body RAW (nằm cạnh `data`, không lồng —
/// khác envelope explore/trending cũ đã bị bóc/gộp).
Map<String, dynamic>? _topMeta(dynamic body) {
  if (body is Map && body['meta'] is Map) return Map<String, dynamic>.from(body['meta'] as Map);
  return null;
}
