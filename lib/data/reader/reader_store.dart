import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'reader_models.dart';

/// Lưu cấu hình đọc + vị trí resume + bookmark + brightness (shared_preferences, JSON).
/// Dữ liệu nhỏ → prefs đủ. Đọc đồng bộ (prefs nạp sẵn), ghi async. Hỏng → mặc định.
class ReaderStore {
  ReaderStore(this._prefs);
  final SharedPreferences _prefs;

  static const _kSettings = 'reader.settings';
  static const _kBrightness = 'reader.brightness';
  static const _kReadAlong = 'reader.readalong';
  static String _posKey(String bookId) => 'reader.pos.$bookId';
  static String _bmKey(String bookId) => 'reader.bm.$bookId';

  Map? _decodeMap(String? s) {
    if (s == null) return null;
    try {
      final v = jsonDecode(s);
      return v is Map ? v : null;
    } catch (_) {
      return null;
    }
  }

  // ── settings ──
  ReaderSettings readSettings() => ReaderSettings.fromMap(_decodeMap(_prefs.getString(_kSettings)) ?? const {});

  Future<void> saveSettings(ReaderSettings s) => _prefs.setString(_kSettings, jsonEncode(s.toMap()));

  // ── position ──
  ReaderPosition? position(String bookId) {
    final m = _decodeMap(_prefs.getString(_posKey(bookId)));
    return m == null ? null : ReaderPosition.fromMap(m);
  }

  Future<void> savePosition(String bookId, int chapter, double offset) => _prefs.setString(
      _posKey(bookId),
      jsonEncode(ReaderPosition(
              chapter: chapter, offset: offset, savedAt: DateTime.now().millisecondsSinceEpoch)
          .toMap()));

  // ── bookmarks ──
  List<Bookmark> bookmarks(String bookId) {
    final raw = _prefs.getString(_bmKey(bookId));
    if (raw == null) return const [];
    try {
      final list = jsonDecode(raw);
      if (list is! List) return const [];
      return list.whereType<Map>().map(Bookmark.fromMap).toList();
    } catch (_) {
      return const [];
    }
  }

  Future<void> addBookmark(String bookId, Bookmark b) async {
    final list = [...bookmarks(bookId), b]..sort((x, y) => y.savedAt.compareTo(x.savedAt));
    await _prefs.setString(_bmKey(bookId), jsonEncode(list.map((e) => e.toMap()).toList()));
  }

  Future<void> removeBookmark(String bookId, int savedAt) async {
    final list = bookmarks(bookId).where((e) => e.savedAt != savedAt).toList();
    await _prefs.setString(_bmKey(bookId), jsonEncode(list.map((e) => e.toMap()).toList()));
  }

  // ── brightness ──
  double readBrightness() => _prefs.getDouble(_kBrightness) ?? -1;
  Future<void> saveBrightness(double v) => _prefs.setDouble(_kBrightness, v);

  // ── read-along ──
  bool readReadAlong() => _prefs.getBool(_kReadAlong) ?? false;
  Future<void> saveReadAlong(bool v) => _prefs.setBool(_kReadAlong, v);
}
