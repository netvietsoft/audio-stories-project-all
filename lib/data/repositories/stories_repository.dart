import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';
import '../../models/models.dart';
import '../cache/json_cache.dart';
import '../mappers/book_mapper.dart';
import '../mappers/chapter_mapper.dart';

/// Kết quả phân trang truyện.
class PagedBooks {
  const PagedBooks({
    required this.books,
    required this.page,
    required this.lastPage,
    required this.total,
  });
  final List<Book> books;
  final int page, lastPage, total;

  bool get hasMore => page < lastPage;
}

/// Chi tiết truyện + danh sách chương (cho BookDetail/Reader).
class StoryDetail {
  const StoryDetail({required this.book, required this.chapters});
  final Book book;
  final List<Chapter> chapters;
}

/// Nội dung một chương (cho Reader).
class ChapterContent {
  const ChapterContent({
    required this.id,
    required this.n,
    required this.title,
    required this.content,
    this.hlsUrl,
  });
  final String id;
  final int n;
  final String title;

  /// Text nội dung. Có thể rỗng với chương chỉ có audio (audiobook).
  final String content;
  final String? hlsUrl;
}

/// Truy xuất truyện từ backend. Ẩn chi tiết API/envelope khỏi UI.
class StoriesRepository {
  StoriesRepository(this._api, [this._cache]);
  final ApiClient _api;
  final JsonCache? _cache;

  // Cache TÁCH theo ngôn ngữ nội dung (đổi lang không lẫn data).
  static String _exploreKey(String lang) => 'cache.stories.explore.$lang';

  /// `GET /stories/explore` — trả `{data:{data:[story],meta:{total,page,lastPage}}}`.
  /// Sau khi ApiClient bóc 1 lớp còn `{data:[story],meta}`.
  Future<PagedBooks> explore({
    int page = 1,
    int limit = 20,
    String? search,
    int? categoryId,
    String? sort,
    String? trendWindow,
    String lang = 'en',
  }) async {
    final inner = await _api.get(ApiEndpoints.storiesExplore, query: {
      'page': page,
      'limit': limit,
      // lang rỗng → KHÔNG gửi (BE trả mọi ngôn ngữ) — dùng cho Discover tìm toàn bộ.
      if (lang.isNotEmpty) 'lang': lang,
      if (search != null && search.isNotEmpty) 'search': search,
      if (categoryId != null) 'categoryId': categoryId,
      if (sort != null && sort.isNotEmpty) 'sort': sort,
      // window today/week/month → lọc theo thời gian (Rising = hot trong tuần).
      if (trendWindow != null && trendWindow.isNotEmpty) 'trendWindow': trendWindow,
    });

    final list = unwrapList(inner);
    final meta = inner is Map ? inner['meta'] : null;

    // Cache feed mặc định (không search/category/sort) theo ngôn ngữ.
    if ((search == null || search.isEmpty) && categoryId == null && (sort == null || sort.isEmpty) && page == 1) {
      _cache?.writeList(_exploreKey(lang), list);
    }

    return PagedBooks(
      books: list
          .whereType<Map>()
          .map((j) => BookMapper.fromJson(Map<String, dynamic>.from(j)))
          .toList(),
      page: _int(meta?['page'], page),
      lastPage: _int(meta?['lastPage'], page),
      total: _int(meta?['total'], list.length),
    );
  }

  /// Đọc feed explore từ cache local theo ngôn ngữ (đồng bộ). Null nếu chưa có.
  ({List<Book> books, Duration age})? cachedExplore(String lang) {
    final c = _cache?.readList(_exploreKey(lang));
    if (c == null) return null;
    final books = c.data
        .whereType<Map>()
        .map((j) => BookMapper.fromJson(Map<String, dynamic>.from(j)))
        .toList();
    return (books: books, age: c.age);
  }

  /// `GET /stories/:slug` — chi tiết + danh sách chương (`chapters[]`).
  Future<StoryDetail> detail(String slug) async {
    final data = await _api.get(ApiEndpoints.storyBySlug(slug));
    final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    final rawChapters = map['chapters'];
    final chapters = (rawChapters is List ? rawChapters : const [])
        .whereType<Map>()
        .map((c) => ChapterMapper.fromJson(Map<String, dynamic>.from(c)))
        .toList();
    return StoryDetail(book: BookMapper.fromJson(map), chapters: chapters);
  }

  /// `GET /chapters/:id/public` — nội dung công khai của chương.
  Future<ChapterContent> chapterContent(String id) async {
    final data = await _api.get(ApiEndpoints.chapterPublic(id));
    final m = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    return ChapterContent(
      id: (m['id'] ?? id).toString(),
      n: _int(m['chapterNumber'], 1),
      title: (m['title'] ?? '').toString(),
      content: (m['content'] ?? '').toString(),
      hlsUrl: m['hlsUrl']?.toString(),
    );
  }

  static int _int(dynamic v, int fallback) =>
      v is int ? v : (v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? fallback);
}
