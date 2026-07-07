import '../../models/models.dart';

/// Map JSON category từ BE (`/stories/categories`) → [Category].
abstract final class CategoryMapper {
  static Category fromJson(Map<String, dynamic> j) {
    final id = j['id'];
    return Category(
      id: id is num ? id.toInt() : int.tryParse('${id ?? ''}') ?? 0,
      name: (j['name'] ?? '').toString(),
      slug: (j['slug'] ?? '').toString(),
    );
  }
}
