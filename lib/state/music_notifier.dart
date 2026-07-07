import 'package:flutter/foundation.dart';

import '../api/api_env.dart';
import '../data/repositories/music_repository.dart';
import '../models/demo_data.dart';
import '../models/models.dart';
import 'async_value.dart';

/// State cho danh sách nhạc. Khi [ApiEnv.useBackend] = false → trả `Demo.songs`.
/// Khi bật → gọi repository; lỗi vẫn fallback `Demo.songs` (kèm [usingFallback]).
/// Mirror [StoriesNotifier].
class MusicNotifier extends ChangeNotifier {
  MusicNotifier(this._repo);
  final MusicRepository _repo;

  AsyncValue<List<Song>> songs = const AsyncLoading();
  bool usingFallback = false;
  bool _inFlight = false;

  static const _ttl = Duration(minutes: 10);

  /// Nạp một lần — bỏ qua nếu đã có data hoặc đang nạp. Dùng [load] (force) cho nút thử lại.
  Future<void> ensureLoaded() async {
    if (songs is AsyncData || _inFlight) return;
    await load();
  }

  Future<void> load({String? search, bool forceRefresh = false}) async {
    _inFlight = true;
    usingFallback = false;
    final noSearch = search == null || search.isEmpty;

    // 1) Hiện cache local ngay.
    final cached = noSearch ? _repo.cachedList() : null;
    if (cached != null) {
      songs = AsyncData(cached.songs);
    } else if (songs is! AsyncData) {
      songs = const AsyncLoading();
    }
    notifyListeners();

    // 2) Demo mode.
    if (!ApiEnv.useBackend) {
      songs = AsyncData(_filterDemo(search));
      usingFallback = true;
      _inFlight = false;
      notifyListeners();
      return;
    }

    // 3) Refresh khi cache cũ/chưa có/ép/có search.
    final needRefresh = forceRefresh || cached == null || cached.age > _ttl || !noSearch;
    if (needRefresh) {
      try {
        final list = await _repo.list(search: search);
        songs = AsyncData(list);
      } catch (e) {
        if (songs is! AsyncData) {
          songs = AsyncData(_filterDemo(search));
          usingFallback = true;
        }
        debugPrint('MusicNotifier refresh failed: $e');
      }
    }
    _inFlight = false;
    notifyListeners();
  }

  List<Song> _filterDemo(String? search) {
    if (search == null || search.trim().isEmpty) return Demo.songs;
    final q = search.toLowerCase();
    return Demo.songs
        .where((s) => s.title.toLowerCase().contains(q) || s.author.toLowerCase().contains(q))
        .toList();
  }
}
