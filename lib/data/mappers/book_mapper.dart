import '../../models/models.dart';

/// Map JSON story từ backend (`/stories/explore`, `/stories/:slug`) → [Book] (model UI).
///
/// Field BE: id, slug, title, description, thumbnailUrl, status, totalViews,
/// averageRating, totalChapters, isInteractive, author{name}, categories[]{category{name}}.
/// Lưu ý: [Book.id] map từ **slug** vì màn chi tiết gọi `/stories/:slug`.
abstract final class BookMapper {
  static Book fromJson(Map<String, dynamic> j) {
    final author = j['author'];
    final categories = j['categories'];
    // Seed ổn định theo slug/id → mỗi truyện giữ cùng giá trị demo qua các lần vẽ.
    final seed = (j['slug'] ?? j['id'] ?? j['title'] ?? '').toString().hashCode.abs();
    return Book(
      id: (j['slug'] ?? j['id'] ?? '').toString(),
      title: (j['title'] ?? '').toString(),
      author: (author is Map ? author['name'] : null)?.toString() ?? '',
      genre: _nthCategory(categories, 0),
      trope: _nthCategory(categories, 1), // thể loại phụ (dòng "Genre · Subgenre")
      cover: (j['thumbnailUrl'] ?? '').toString(),
      rating: _ratingStr(j['averageRating'], seed),
      reads: _readsStr(j['totalViews'], seed),
      status: (j['status'] ?? 'Ongoing').toString(),
      chapters: _asInt(j['totalChapters']),
      synopsis: (j['description'] ?? '').toString(),
      unlockPrice: _asInt(j['unlockPrice']),
      discountPercent: _asInt(j['discountPercent']),
      categoriesLabel: _categoriesLabel(categories),
      label: _label(j['label']),
      uuid: j['id']?.toString(),
    );
  }

  /// Gộp tối đa 3 tên thể loại thành "A · B · C" (cho list kết quả search).
  static String _categoriesLabel(dynamic categories) {
    if (categories is! List) return '';
    final names = <String>[];
    for (final item in categories) {
      final cat = item is Map ? item['category'] : null;
      if (cat is Map && cat['name'] != null) names.add(cat['name'].toString());
      if (names.length == 3) break;
    }
    return names.join(' · ');
  }

  /// Thể loại thứ [n] trong danh sách categories[] (0 = chính, 1 = phụ). '' nếu thiếu.
  static String _nthCategory(dynamic categories, int n) {
    if (categories is List && categories.length > n) {
      final item = categories[n];
      final cat = item is Map ? item['category'] : null;
      if (cat is Map && cat['name'] != null) return cat['name'].toString();
    }
    return '';
  }

  /// Label bìa từ BE (`label: {text, color, icon}`); thiếu/thiếu text|color → null.
  static StoryLabel? _label(dynamic v) {
    if (v is! Map) return null;
    final text = (v['text'] ?? '').toString();
    final color = (v['color'] ?? '').toString();
    if (text.isEmpty || color.isEmpty) return null;
    return StoryLabel(text: text, color: color, icon: v['icon']?.toString());
  }

  /// Số sao: dùng giá trị thật nếu >= 3.0; nếu thiếu/thấp → demo random 3.0–5.0
  /// (ổn định theo [seed]).
  static String _ratingStr(dynamic r, int seed) {
    final d = r is num ? r.toDouble() : double.tryParse('${r ?? ''}') ?? 0;
    if (d >= 3.0) return d.toStringAsFixed(1);
    final demo = 3.0 + (seed % 21) / 10.0; // 3.0 .. 5.0
    return demo.toStringAsFixed(1);
  }

  /// Lượt đọc: dùng giá trị thật nếu >= 1M; nếu thấp hơn → demo random 1M–15M
  /// (ổn định theo [seed]) rồi rút gọn.
  static String _readsStr(dynamic v, int seed) {
    final n = v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
    if (n >= 1000000) return formatCount(n);
    final demo = 1000000 + (seed * 2654435761 % 14000000); // 1M .. ~15M
    return formatCount(demo);
  }

  static int _asInt(dynamic v) =>
      v is int ? v : (v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0);
}

/// 12.300.000 → "12.3M", 5.300 → "5.3K" (rút gọn lượt xem/đọc cho UI).
String formatCount(dynamic value) {
  final n = value is num
      ? value.toDouble()
      : double.tryParse('${value ?? ''}') ?? 0;
  if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
  if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
  return n.toInt().toString();
}
