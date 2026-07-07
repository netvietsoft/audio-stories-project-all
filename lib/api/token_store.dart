import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Lưu token an toàn (Keychain iOS / Keystore-backed EncryptedSharedPreferences Android).
/// KHÔNG dùng shared_preferences cho token.
class TokenStore {
  TokenStore([FlutterSecureStorage? storage])
      : _s = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _s;

  static const _kAccess = 'access_token';
  static const _kRefresh = 'refresh_token';

  Future<String?> readAccess() => _s.read(key: _kAccess);
  Future<String?> readRefresh() => _s.read(key: _kRefresh);

  Future<void> save({required String access, String? refresh}) async {
    await _s.write(key: _kAccess, value: access);
    if (refresh != null && refresh.isNotEmpty) {
      await _s.write(key: _kRefresh, value: refresh);
    }
  }

  Future<void> clear() async {
    await _s.delete(key: _kAccess);
    await _s.delete(key: _kRefresh);
  }
}
