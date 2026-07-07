import 'package:flutter/foundation.dart';

import '../api/api_env.dart';
import '../api/api_exception.dart';
import '../data/repositories/auth_repository.dart';
import '../models/models.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// State xác thực toàn cục. Orchestrate login/verify/logout + giữ [user] hiện tại.
/// Token do [AuthRepository] lưu (secure storage) + gắn vào ApiClient.
class AuthNotifier extends ChangeNotifier {
  AuthNotifier(this._repo);
  final AuthRepository _repo;

  AuthStatus status = AuthStatus.unknown;
  AppUser? user;
  bool busy = false;
  String? error;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  /// Gọi 1 lần lúc mở app.
  Future<void> restore() async {
    if (!ApiEnv.useBackend) {
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    final u = await _repo.restoreSession();
    user = u;
    status = u != null ? AuthStatus.authenticated : AuthStatus.unauthenticated;
    notifyListeners();
  }

  Future<bool> login(String email, String password) => _run(() => _repo.login(email, password));

  Future<bool> verifyCode(String email, String code) => _run(() => _repo.verifyCode(email, code));

  Future<void> logout() async {
    await _repo.logout();
    user = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  /// Làm lại [me] sau khi có thay đổi (vd sau khi unlock/nạp Pulse) để đồng bộ số dư.
  Future<void> refreshUser() async {
    try {
      user = await _repo.me();
      notifyListeners();
    } catch (_) {/* giữ user cũ */}
  }

  Future<bool> _run(Future<AppUser> Function() action) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      user = await action();
      status = AuthStatus.authenticated;
      return true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } catch (e) {
      error = 'Đã có lỗi xảy ra';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }
}
