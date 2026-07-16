/// Tất cả đường dẫn endpoint backend — TẬP TRUNG MỘT NƠI.
///
/// Quy tắc: BE **không** có prefix `/api`; path ở đây là path thật (vd `/stories`).
/// Base URL (domain/IP) cấu hình ở `api_env.dart`. Khi BE thêm/đổi route → sửa ở
/// file này, KHÔNG rải string '/stories/...' trong repository.
class ApiEndpoints {
  ApiEndpoints._();

  // ── Auth ──
  static const authLogin = '/auth/login';
  static const authRegister = '/auth/register';
  static const authRefresh = '/auth/refresh';
  static const authLogout = '/auth/logout';
  static const authMe = '/auth/me';
  static const authVerifyCode = '/auth/verify-code';
  static const authForgotPassword = '/auth/forgot-password';
  static const authResetPassword = '/auth/reset-password';
  static const authChangePassword = '/auth/change-password';

  // ── Stories / Chapters ──
  static const storiesExplore = '/stories/explore';
  static const storiesHome = '/stories/home';
  static const storiesTrending = '/stories/trending';
  static const storiesCategories = '/stories/categories';
  static const storiesCategoriesTop = '/stories/categories/top';
  static const storiesRecommended = '/stories/recommended';
  static String storyBySlug(String slug) => '/stories/$slug';
  static String storyUnlock(String id) => '/stories/$id/unlock';
  static String chapterPublic(String id) => '/chapters/$id/public';
  /// Proxy audio (302 sau entitlement). HLS m3u8 lấy từ field `hlsUrl` của response.
  static String chapterAudio(String id) => '/chapters/$id/audio';

  // ── Comments (chương/đoạn) ──
  static String chapterComments(String chapterId) => '/chapters/$chapterId/comments';
  static String commentReplies(String commentId) => '/comments/$commentId/replies';
  static String commentReactions(String commentId) => '/comments/$commentId/reactions';
  static String commentReport(String commentId) => '/comments/$commentId/report';

  // ── Music ──
  static const music = '/music';
  static String musicBySlug(String slug) => '/music/$slug';

  // ── Billing / Packages ──
  static const packages = '/packages';
  static const billingCheckout = '/billing/checkout';
  static const memberships = '/memberships';

  // ── Khác ──
  static const banners = '/banners';
  static const notifications = '/notifications';

  // ── Tracking ──
  static const trackSearchOpen = '/tracking/search-open';
}
