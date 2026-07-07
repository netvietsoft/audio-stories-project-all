import 'package:flutter/foundation.dart';

/// Môi trường backend.
enum ApiEnvironment { dev, staging, prod }

/// ╔══════════════════════════════════════════════════════════════════════╗
/// ║  CẤU HÌNH KẾT NỐI BACKEND — ĐỔI Ở ĐÂY khi BE tách ra VPS.            ║
/// ╚══════════════════════════════════════════════════════════════════════╝
///
/// Hiện BE chạy cùng máy (localhost). Khi BE lên VPS, chỉ cần:
///   1) điền [prodBaseUrl] = domain/IP thật của VPS, và
///   2) chạy app với `--dart-define=API_ENV=prod`
/// hoặc đổi [defaultEnvironment] = ApiEnvironment.prod.
///
/// Có thể override trực tiếp base URL mà không sửa code:
///   flutter run --dart-define=API_BASE_URL=https://api.novelverse.vn
///
/// Toàn bộ endpoint path nằm ở `api_endpoints.dart` (không rải string khắp nơi).
class ApiEnv {
  ApiEnv._();

  // ── ĐỔI 2 GIÁ TRỊ NÀY KHI LÊN VPS ──────────────────────────────────────
  /// Domain/IP backend production (VPS). Ví dụ: 'https://api.novelverse.vn'
  /// hoặc 'http://203.0.113.10:3000'. KHÔNG kèm prefix /api (BE không có).
  static const String prodBaseUrl = 'https://api.example.com';

  /// Domain/IP staging (nếu có). Để trống nếu chưa dùng.
  static const String stagingBaseUrl = 'https://staging-api.example.com';
  // ────────────────────────────────────────────────────────────────────────

  /// Môi trường mặc định khi build (nếu không truyền --dart-define=API_ENV).
  static const ApiEnvironment defaultEnvironment = ApiEnvironment.dev;

  /// Base URL dev. Android emulator phải dùng 10.0.2.2 để trỏ về localhost máy host.
  static const String _devAndroid = 'http://10.0.2.2:9001';
  static const String _devLocalhost = 'http://localhost:9001';

  // --dart-define
  static const String _envName = String.fromEnvironment('API_ENV');
  static const String _baseUrlOverride = String.fromEnvironment('API_BASE_URL');

  /// Bật gọi backend thật. MẶC ĐỊNH false → app dùng dữ liệu `Demo` (prototype
  /// chạy ngay, không cần backend). Bật: --dart-define=USE_BACKEND=true.
  static const bool useBackend =
      bool.fromEnvironment('USE_BACKEND', defaultValue: false);

  /// Ngôn ngữ nội dung mặc định khi query stories/music.
  static const String defaultLang = 'vi';

  /// Môi trường đang chạy (ưu tiên --dart-define=API_ENV).
  static ApiEnvironment get environment {
    switch (_envName) {
      case 'prod':
        return ApiEnvironment.prod;
      case 'staging':
        return ApiEnvironment.staging;
      case 'dev':
        return ApiEnvironment.dev;
      default:
        return defaultEnvironment;
    }
  }

  /// Base URL hiệu dụng (ưu tiên override --dart-define=API_BASE_URL).
  static String get baseUrl {
    if (_baseUrlOverride.isNotEmpty) return _baseUrlOverride;
    switch (environment) {
      case ApiEnvironment.prod:
        return prodBaseUrl;
      case ApiEnvironment.staging:
        return stagingBaseUrl;
      case ApiEnvironment.dev:
        final isAndroid = !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
        return isAndroid ? _devAndroid : _devLocalhost;
    }
  }
}
