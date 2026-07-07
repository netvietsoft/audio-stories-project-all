import 'package:flutter/foundation.dart';

import '../api/api_env.dart';
import '../data/repositories/stories_repository.dart';
import '../models/models.dart';
import 'async_value.dart';

/// State cho danh sách truyện (explore) — CHỈ dữ liệu THẬT từ backend (không còn
/// fallback demo). Lỗi mạng → [AsyncError] (màn hiện nút thử lại); tắt backend →
/// rỗng. Hiện cache local ngay để không trắng màn, rồi làm mới theo TTL.
class StoriesNotifier extends ChangeNotifier {
  StoriesNotifier(this._repo);
  final StoriesRepository _repo;

  AsyncValue<List<Book>> explore = const AsyncLoading();
  String _lang = ''; // ngôn ngữ nội dung đang tải

  /// Sau TTL này mới gọi backend làm mới (cache local dùng trong khoảng đó).
  /// Ngắn để nội dung mới đẩy lên backend xuất hiện nhanh; vẫn hiện cache tức thì.
  static const _ttl = Duration(minutes: 1);

  /// Áp ngôn ngữ nội dung [lang] rồi nạp (SWR). Gọi từ màn (theo AppState.contentLang);
  /// đổi ngôn ngữ → nạp lại đúng ngôn ngữ đó. Dùng chung 1 instance (Home + Discover).
  Future<void> applyLang(String lang) async {
    if (_lang == lang && explore is AsyncData) return;
    _lang = lang;
    await loadExplore();
  }

  Future<void> loadExplore({String? search, int? categoryId, String? sort, bool forceRefresh = false}) async {
    final noFilter = (search == null || search.isEmpty) && categoryId == null && (sort == null || sort.isEmpty);

    // 1) Hiện CACHE local ngay (feed mặc định, theo ngôn ngữ) → không chờ mạng.
    final cached = noFilter ? _repo.cachedExplore(_lang) : null;
    if (cached != null) {
      explore = AsyncData(cached.books);
    } else if (explore is! AsyncData) {
      explore = const AsyncLoading();
    }
    notifyListeners();

    // 2) Chưa bật backend → rỗng (không còn dữ liệu demo).
    if (!ApiEnv.useBackend) {
      explore = const AsyncData([]);
      notifyListeners();
      return;
    }

    // 3) Chỉ gọi backend khi cache CŨ (> TTL) / chưa có / ép refresh / có lọc.
    final needRefresh = forceRefresh || cached == null || cached.age > _ttl || !noFilter;
    if (needRefresh) {
      try {
        final paged = await _repo.explore(search: search, categoryId: categoryId, sort: sort, lang: _lang);
        explore = AsyncData(paged.books);
      } catch (e) {
        // Giữ cache đang hiển thị nếu có; không có thì báo lỗi (nút thử lại).
        if (explore is! AsyncData) explore = AsyncError(e);
        debugPrint('StoriesNotifier refresh failed: $e');
      }
    }
    notifyListeners();
  }
}
