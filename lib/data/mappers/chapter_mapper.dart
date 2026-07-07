import '../../models/models.dart';

/// Map JSON chương từ backend → [Chapter].
///
/// Field BE: id, chapterNumber, title, accessType (free|timed|vip|ads),
/// unlockPrice, discountPercent.
/// `ChapterState.current` là khái niệm UI (chương đang đọc) — KHÔNG có ở BE.
abstract final class ChapterMapper {
  static Chapter fromJson(Map<String, dynamic> j) {
    return Chapter(
      id: (j['id'] ?? '').toString(),
      n: _asInt(j['chapterNumber']),
      title: (j['title'] ?? '').toString(),
      state: accessTypeToState((j['accessType'] ?? 'free').toString()),
      price: _asInt(j['unlockPrice'], fallback: 15),
      hlsUrl: (j['hlsUrl'] ?? '').toString(),
    );
  }

  /// BE `ChapterAccessType` (chữ thường) → UI `ChapterState`.
  /// timed/ads (mở bằng thời gian/quảng cáo) gộp về `coin` vì UI chỉ có free/coin/vip.
  static ChapterState accessTypeToState(String accessType) {
    switch (accessType.toLowerCase()) {
      case 'free':
        return ChapterState.free;
      case 'vip':
        return ChapterState.vip;
      case 'timed':
      case 'ads':
      default:
        return ChapterState.coin;
    }
  }

  static int _asInt(dynamic v, {int fallback = 0}) =>
      v is int ? v : (v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? fallback);
}
