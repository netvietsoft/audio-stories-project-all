import 'package:dio/dio.dart';

import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';
import '../../api/api_exception.dart';
import '../../api/token_store.dart';
import '../../models/models.dart';
import '../mappers/user_mapper.dart';

/// Xác thực: login/verify/refresh/logout + quản lý token.
///
/// BE trả `access_token` trong body (bọc `{data,meta}`) và `refresh_token` trong
/// **Set-Cookie**. Mobile: đọc refresh từ Set-Cookie khi login → lưu secure storage
/// → gửi lại qua header `x-refresh-token` khi refresh (BE chấp nhận cả header).
class AuthRepository {
  AuthRepository(this._api, this._store);
  final ApiClient _api;
  final TokenStore _store;

  Future<AppUser> login(String email, String password) async {
    final res = await _api.postRaw(ApiEndpoints.authLogin, body: {'email': email, 'password': password});
    _throwIfError(res);
    await _persistFrom(res);
    return me();
  }

  Future<AppUser> verifyCode(String email, String code) async {
    final res = await _api.postRaw(ApiEndpoints.authVerifyCode, body: {'email': email, 'code': code});
    _throwIfError(res);
    await _persistFrom(res);
    return me();
  }

  /// Khôi phục phiên lúc mở app: nạp access đã lưu, gọi /me. Nếu access hết hạn,
  /// ApiClient tự refresh (callback). Thất bại → xoá token, trả null.
  Future<AppUser?> restoreSession() async {
    final access = await _store.readAccess();
    if (access == null || access.isEmpty) return null;
    _api.accessToken = access;
    try {
      return await me();
    } catch (_) {
      await _store.clear();
      _api.accessToken = null;
      return null;
    }
  }

  Future<AppUser> me() async {
    final data = await _api.get(ApiEndpoints.authMe);
    final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    return UserMapper.fromJson(map);
  }

  /// Dùng làm [ApiClient.refreshCallback]. Trả access token mới hoặc null.
  Future<String?> refresh() async {
    final refreshToken = await _store.readRefresh();
    if (refreshToken == null || refreshToken.isEmpty) return null;
    final res = await _api.postRaw(ApiEndpoints.authRefresh, headers: {'x-refresh-token': refreshToken});
    if ((res.statusCode ?? 500) >= 400) return null;
    final access = _accessFrom(res);
    if (access == null) return null;
    await _store.save(access: access, refresh: _refreshFromCookie(res.headers));
    _api.accessToken = access;
    return access;
  }

  Future<void> logout() async {
    try {
      await _api.post(ApiEndpoints.authLogout);
    } catch (_) {
      // best-effort; vẫn xoá local
    }
    await _store.clear();
    _api.accessToken = null;
  }

  Future<void> changePassword(String current, String next) async {
    await _api.post(ApiEndpoints.authChangePassword, body: {
      'currentPassword': current,
      'newPassword': next,
    });
  }

  // ── helpers ──

  Future<void> _persistFrom(Response res) async {
    final access = _accessFrom(res);
    if (access == null) {
      throw ApiException('no_token', 'Không nhận được access token');
    }
    await _store.save(access: access, refresh: _refreshFromCookie(res.headers));
    _api.accessToken = access;
  }

  void _throwIfError(Response res) {
    if ((res.statusCode ?? 500) < 400) return;
    final body = res.data;
    if (body is Map && body['error'] is Map) {
      final err = body['error'] as Map;
      throw ApiException((err['code'] ?? 'error').toString(), (err['message'] ?? 'Đăng nhập thất bại').toString(), status: res.statusCode);
    }
    throw ApiException('http_${res.statusCode}', 'Đăng nhập thất bại', status: res.statusCode);
  }

  /// access_token trong body (đã bọc `{data:{...}}`).
  String? _accessFrom(Response res) {
    final body = res.data;
    final data = body is Map && body['data'] is Map ? body['data'] as Map : body;
    final token = data is Map ? data['access_token'] : null;
    return token?.toString();
  }

  /// refresh_token trích từ header Set-Cookie.
  String? _refreshFromCookie(Headers headers) {
    final cookies = headers.map['set-cookie'] ?? const [];
    for (final c in cookies) {
      if (c.startsWith('refresh_token=')) {
        return c.substring('refresh_token='.length).split(';').first;
      }
    }
    return null;
  }
}
