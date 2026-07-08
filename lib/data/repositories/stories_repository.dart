import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';
import '../../models/models.dart';
import '../cache/json_cache.dart';
import '../mappers/book_mapper.dart';
import '../mappers/chapter_mapper.dart';
import '../offline/offline_store.dart';
import '../offline/offline_models.dart';
import '../offline/connectivity_service.dart';
import '../offline/download_manager.dart';

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

/// 1 câu timing read-along (ms + vị trí ký tự trong đoạn `paraIndex`).
class TimingCue {
  const TimingCue({
    required this.startMs, required this.endMs,
    required this.paraIndex, required this.charStart, required this.charEnd,
  });
  final int startMs, endMs, paraIndex, charStart, charEnd;

  factory TimingCue.fromMap(Map m) {
    int i(dynamic v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;
    return TimingCue(
      startMs: i(m['s']), endMs: i(m['e']), paraIndex: m['p'] is num ? (m['p'] as num).toInt() : -1,
      charStart: i(m['cs']), charEnd: i(m['ce']),
    );
  }
}

/// Index cue đang phát (startMs<=pos<endMs), hoặc null. cues giả định sắp theo startMs.
int? activeCueIndex(List<TimingCue> cues, int posMs) {
  for (var i = 0; i < cues.length; i++) {
    if (posMs >= cues[i].startMs && posMs < cues[i].endMs) return i;
  }
  return null;
}

/// Nội dung một chương (cho Reader).
class ChapterContent {
  const ChapterContent({
    required this.id,
    required this.n,
    required this.title,
    required this.content,
    this.hlsUrl,
    this.cues = const [],
  });
  final String id;
  final int n;
  final String title;

  /// Text nội dung. Có thể rỗng với chương chỉ có audio (audiobook).
  final String content;
  final String? hlsUrl;
  final List<TimingCue> cues;
}

/// Truy xuất truyện từ backend. Ẩn chi tiết API/envelope khỏi UI.
class StoriesRepository implements StoriesRepositoryLike {
  StoriesRepository(this._api, [this._cache, this._offline, this._connectivity]);
  final ApiClient _api;
  final JsonCache? _cache;
  final OfflineStore? _offline;
  final ConnectivityService? _connectivity;

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
  /// Local-first: nếu đang offline HOẶC truyện đã downloaded VÀ có meta local
  /// → dựng từ local, KHÔNG gọi API. Online mà API lỗi → fallback về meta local nếu có.
  Future<StoryDetail> detail(String slug) async {
    final off = _offline;
    final offline = _connectivity?.isOnline == false;
    final downloaded = off?.download(slug)?.kind == 'downloaded';
    if (off != null && (offline || downloaded)) {
      final meta = off.readStoryMeta(slug);
      if (meta != null) return _detailFromMeta(slug, meta);
    }
    try {
      final data = await _api.get(ApiEndpoints.storyBySlug(slug));
      final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
      final rawChapters = map['chapters'];
      final chapters = (rawChapters is List ? rawChapters : const [])
          .whereType<Map>()
          .map((c) => ChapterMapper.fromJson(Map<String, dynamic>.from(c)))
          .toList();
      return StoryDetail(book: BookMapper.fromJson(map), chapters: chapters);
    } catch (_) {
      final meta = off?.readStoryMeta(slug);
      if (meta != null) return _detailFromMeta(slug, meta);
      rethrow;
    }
  }

  /// Dựng [StoryDetail] từ meta + record local (không gọi API).
  StoryDetail _detailFromMeta(String storyId, OfflineStoryMeta meta) {
    final rec = _offline!.download(storyId);
    final book = Book(
      id: storyId,
      title: rec?.title ?? '',
      author: meta.author,
      genre: meta.genre,
      cover: meta.cover,
      trope: meta.trope,
      rating: meta.rating,
      reads: meta.reads,
      status: meta.status,
      chapters: meta.totalChapters,
      subtitle: meta.subtitle,
      synopsis: meta.synopsis,
      unlockPrice: meta.unlockPrice,
      discountPercent: meta.discountPercent,
    );
    final chapters = meta.chapters.map((c) => Chapter(
          n: _int(c['n'], 0),
          title: (c['title'] ?? '').toString(),
          state: _stateFromName((c['state'] ?? '').toString()),
          id: (c['chapterId'] ?? '').toString(),
          hasAudio: c['hasAudio'] == true,
        )).toList();
    return StoryDetail(book: book, chapters: chapters);
  }

  /// `ChapterState.name` (lưu lúc download) → enum. Ngược với [ChapterMapper.accessTypeToState].
  static ChapterState _stateFromName(String name) {
    switch (name) {
      case 'coin':
        return ChapterState.coin;
      case 'vip':
        return ChapterState.vip;
      case 'current':
        return ChapterState.current;
      case 'free':
      default:
        return ChapterState.free;
    }
  }

  /// `GET /chapters/:id/public` — nội dung công khai của chương.
  /// Local-first: nếu đã có sẵn offline VÀ (truyện đã downloaded HOẶC đang offline) → đọc local.
  Future<ChapterContent> chapterContent(String id) async {
    final off = _offline;
    final offline = _connectivity?.isOnline == false;
    final isDownloaded = off?.download(_storyIdOfChapter(id))?.kind == 'downloaded';
    if (off != null && off.hasChapter(id) && (isDownloaded || offline)) {
      final c = off.readChapter(id)!;
      return ChapterContent(id: c.chapterId, n: c.n, title: c.title, content: c.content);
    }
    final data = await _api.get(ApiEndpoints.chapterPublic(id));
    final m = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    final timingMap = m['timing'];
    final cues = (timingMap is Map && timingMap['cues'] is List)
        ? (timingMap['cues'] as List).whereType<Map>().map(TimingCue.fromMap).toList()
        : <TimingCue>[];
    final content = ChapterContent(
      id: (m['id'] ?? id).toString(),
      n: _int(m['chapterNumber'], 1),
      title: (m['title'] ?? '').toString(),
      content: (m['content'] ?? '').toString(),
      hlsUrl: m['hlsUrl']?.toString(),
      cues: cues,
    );
    // Auto-cache text nếu có offline store (không đụng eviction ở đây — làm khi save audio/AppState).
    // MERGE với bản ghi cũ để không xoá mất audioFile đã auto-cache trước đó.
    if (off != null && content.content.isNotEmpty) {
      final existing = off.readChapter(content.id);
      await off.saveChapter(OfflineChapter(
        chapterId: content.id,
        storyId: existing?.storyId.isNotEmpty == true ? existing!.storyId : (m['storyId'] ?? '').toString(),
        n: content.n, title: content.title, content: content.content,
        hasAudio: existing?.hasAudio ?? false, audioFile: existing?.audioFile));
    }
    return content;
  }

  String _storyIdOfChapter(String chapterId) => _offline?.readChapter(chapterId)?.storyId ?? '';

  @override
  Future<String> chapterText(String chapterId) async => (await chapterContent(chapterId)).content;

  @override
  Future<StoryDetailData> detailData(String storyIdOrSlug) async {
    final d = await detail(storyIdOrSlug);
    return StoryDetailData(
      storyId: d.book.id, slug: storyIdOrSlug, title: d.book.title, cover: d.book.cover,
      author: d.book.author, language: 'vi', synopsis: d.book.synopsis, subtitle: d.book.subtitle,
      status: d.book.status, genre: d.book.genre, trope: d.book.trope,
      rating: d.book.rating, reads: d.book.reads, unlockPrice: d.book.unlockPrice,
      discountPercent: d.book.discountPercent,
      chapters: d.chapters.map((c) => ChapterMeta(
        chapterId: c.id, n: c.n, title: c.title,
        state: c.state.name, hasAudio: c.hasAudio)).toList());
  }

  static int _int(dynamic v, int fallback) =>
      v is int ? v : (v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? fallback);
}
