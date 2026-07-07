import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Kết quả đọc cache kèm tuổi (để quyết định refresh theo TTL).
class CachedList {
  const CachedList(this.data, this.age);
  final List<dynamic> data;
  final Duration age;
}

/// Cache JSON list vào shared_preferences kèm mốc thời gian → stale-while-revalidate.
/// Dùng cho danh sách list (stories/explore, music). Dữ liệu nhỏ nên prefs đủ;
/// muốn lớn hơn/offline nhiều → chuyển hive sau (xem docs/06).
class JsonCache {
  JsonCache(this._prefs);
  final SharedPreferences _prefs;

  void writeList(String key, List<dynamic> data) {
    try {
      _prefs.setString(key, jsonEncode({
        'savedAt': DateTime.now().millisecondsSinceEpoch,
        'data': data,
      }));
    } catch (_) {/* bỏ qua lỗi ghi cache */}
  }

  /// Đọc cache; null nếu chưa có/hỏng.
  CachedList? readList(String key) {
    final s = _prefs.getString(key);
    if (s == null) return null;
    try {
      final m = jsonDecode(s) as Map<String, dynamic>;
      final savedAt = (m['savedAt'] as num).toInt();
      final data = (m['data'] as List<dynamic>);
      final age = Duration(milliseconds: DateTime.now().millisecondsSinceEpoch - savedAt);
      return CachedList(data, age);
    } catch (_) {
      return null;
    }
  }
}
