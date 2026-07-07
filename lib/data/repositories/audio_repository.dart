import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';

/// Giải URL audio thật của chương qua proxy `/chapters/:id/audio` (302).
/// Kèm Bearer (ApiClient) để chương trả phí được cấp quyền; chưa đủ quyền → BE
/// trả lỗi (ApiException) → UI xử lý (cần mở khoá / đăng nhập).
class AudioRepository {
  AudioRepository(this._api);
  final ApiClient _api;

  /// Trả URL audio (MP3/CDN) đã resolve, hoặc null nếu không lấy được.
  Future<String?> chapterAudioUrl(String chapterId, {String? variantId}) {
    return _api.resolveRedirect(
      ApiEndpoints.chapterAudio(chapterId),
      query: {if (variantId != null && variantId.isNotEmpty) 'variantId': variantId},
    );
  }
}
