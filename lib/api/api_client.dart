import 'package:dio/dio.dart';

import 'api_env.dart';
import 'api_exception.dart';

/// Client HTTP mỏng quanh Dio cho backend NestJS audio-stories.
///
/// - Base URL từ [ApiEnv.baseUrl] (cấu hình domain/IP ở `api_env.dart`; KHÔNG thêm /api).
/// - Tự **bóc envelope** `{ data, meta }`: các method trả về phần `data` (bóc 1 lớp).
///   Endpoint list bọc 2 lớp (`{data:{data:[],meta}}`) → repository dùng [unwrapList].
/// - Map lỗi BE `{ error:{code,message} }` + lỗi mạng → [ApiException].
/// - Hỗ trợ gắn access token (Bearer) cho các request cần auth.
class ApiClient {
  ApiClient([Dio? dio])
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: ApiEnv.baseUrl,
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 20),
              // Tự map lỗi 4xx; chỉ để Dio ném với 5xx/timeout/connection.
              validateStatus: (s) => s != null && s < 500,
            ));

  final Dio _dio;
  String? _accessToken;

  /// Callback làm mới access token khi gặp 401 (do AuthNotifier cung cấp). Trả
  /// access token mới hoặc null nếu refresh thất bại. ApiClient tự retry 1 lần.
  Future<String?> Function()? refreshCallback;

  /// Base URL đang dùng (tiện debug/log).
  String get baseUrl => _dio.options.baseUrl;

  /// Access token hiện tại (đọc để build header nơi khác nếu cần).
  String? get accessToken => _accessToken;

  /// Gắn/huỷ access token (gọi sau login/refresh).
  set accessToken(String? token) => _accessToken = token;

  /// POST trả RAW [Response] (không bóc envelope) — dùng cho auth để đọc header
  /// Set-Cookie (refresh_token) + body. Không tự refresh-retry.
  Future<Response<dynamic>> postRaw(
    String path, {
    Object? body,
    Map<String, String>? headers,
  }) {
    return _dio.post(
      path,
      data: body,
      options: Options(headers: {
        if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
        if (headers != null) ...headers,
      }),
    );
  }

  Options get _opts => Options(
        headers: {
          if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
        },
      );

  /// GET envelope. `raw:true` trả nguyên body `{data,meta}` (KHÔNG bóc envelope) —
  /// dùng khi cần đọc `meta` phân trang (vd /stories/explore); vẫn qua refresh-retry.
  Future<dynamic> get(String path, {Map<String, dynamic>? query, bool raw = false}) =>
      _send(() => _dio.get(path, queryParameters: query, options: _opts), raw: raw);

  /// GET nhưng KHÔNG follow redirect — trả `Location` của 302 (dùng cho
  /// `/chapters/:id/audio`: BE 302 tới URL audio thật sau khi kiểm entitlement).
  /// Gửi kèm Bearer để chương trả phí được cấp quyền. Trả null nếu không phải redirect.
  Future<String?> resolveRedirect(String path, {Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.get(
        path,
        queryParameters: query,
        options: Options(followRedirects: false, headers: _opts.headers),
      );
      final code = res.statusCode ?? 0;
      if (code >= 300 && code < 400) return res.headers.value('location');
      if (code >= 400) throw _fromErrorBody(res.data, code);
      return null;
    } on DioException catch (e) {
      final loc = e.response?.headers.value('location');
      if (loc != null && loc.isNotEmpty) return loc;
      throw _fromDio(e);
    }
  }

  Future<dynamic> post(String path, {Object? body}) =>
      _send(() => _dio.post(path, data: body, options: _opts));

  Future<dynamic> _send(Future<Response<dynamic>> Function() run,
      {bool allowRetry = true, bool raw = false}) async {
    try {
      final res = await run();
      // 401 → thử refresh 1 lần rồi chạy lại (thunk `run` đọc lại token mới qua _opts).
      if (res.statusCode == 401 && allowRetry && refreshCallback != null) {
        final newToken = await refreshCallback!();
        if (newToken != null && newToken.isNotEmpty) {
          _accessToken = newToken;
          return _send(run, allowRetry: false, raw: raw);
        }
      }
      final body = res.data;
      if (res.statusCode != null && res.statusCode! >= 400) {
        throw _fromErrorBody(body, res.statusCode);
      }
      return raw ? body : _unwrap(body);
    } on DioException catch (e) {
      throw _fromDio(e);
    }
  }

  /// Bóc 1 lớp envelope `{ data, meta }`.
  static dynamic _unwrap(dynamic body) {
    if (body is Map && body.containsKey('data')) return body['data'];
    return body;
  }

  ApiException _fromErrorBody(dynamic body, int? status) {
    if (body is Map && body['error'] is Map) {
      final err = body['error'] as Map;
      return ApiException(
        (err['code'] ?? 'error').toString(),
        (err['message'] ?? 'Request failed').toString(),
        status: status,
      );
    }
    return ApiException('http_$status', 'Request failed', status: status);
  }

  ApiException _fromDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException('timeout', 'Kết nối quá hạn, thử lại.');
      case DioExceptionType.connectionError:
        return ApiException('network', 'Không có kết nối mạng.');
      default:
        if (e.response != null) {
          return _fromErrorBody(e.response!.data, e.response!.statusCode);
        }
        return ApiException('unknown', e.message ?? 'Đã có lỗi xảy ra.');
    }
  }
}

/// Lấy MẢNG từ body — bóc tiếp các lớp `{data:...}` lồng nhau (phòng thủ với
/// endpoint bọc 2 lớp cũ lẫn single-wrap mới). Trả [] nếu không phải list.
List<dynamic> unwrapList(dynamic body) {
  var x = body;
  var guard = 0;
  while (x is Map && x.containsKey('data') && guard < 3) {
    x = x['data'];
    guard++;
  }
  return x is List ? x : const [];
}

/// Lấy MAP `meta` phân trang từ body RAW (chưa bóc envelope). Bóc các lớp
/// `{data,meta}` lồng nhau và trả `meta` ở lớp mà `data` là List — chịu được cả
/// single-wrap mới `{data:[],meta}` lẫn double-wrap cũ `{data:{data:[],meta}}`.
/// Null nếu không tìm thấy meta phân trang.
Map<String, dynamic>? unwrapMeta(dynamic body) {
  var x = body;
  var guard = 0;
  while (x is Map && guard < 3) {
    if (x['data'] is List) {
      final m = x['meta'];
      return m is Map ? Map<String, dynamic>.from(m) : null;
    }
    final next = x['data'];
    if (next == null) return null;
    x = next;
    guard++;
  }
  return null;
}
