import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/api/api_exception.dart';
import 'package:novelverse/api/google_auth.dart';
import 'package:novelverse/api/token_store.dart';
import 'package:novelverse/data/mappers/user_mapper.dart';
import 'package:novelverse/data/repositories/auth_repository.dart';
import 'package:novelverse/models/models.dart';
import 'package:novelverse/state/auth_notifier.dart';

class _FakeRepo extends AuthRepository {
  _FakeRepo({this.user, this.error}) : super(ApiClient(), TokenStore());
  final AppUser? user;
  final ApiException? error;
  @override
  Future<AppUser> loginGoogle(String idToken) async {
    if (error != null) throw error!;
    return user!;
  }
}

class _FakeGoogle extends GoogleAuth {
  _FakeGoogle(this.token);
  final String? token;
  @override
  Future<String?> idToken() async => token;
}

void main() {
  final appUser = UserMapper.fromJson(const {'id': 'u1', 'email': 'a@b.c'});

  test('thành công: user set, status authenticated, error null', () async {
    final n = AuthNotifier(_FakeRepo(user: appUser), google: _FakeGoogle('tok'));
    final ok = await n.loginWithGoogle();
    expect(ok, isTrue);
    expect(n.user?.email, 'a@b.c');
    expect(n.status, AuthStatus.authenticated);
    expect(n.error, isNull);
  });

  test('user hủy popup (idToken null): false NHƯNG error vẫn null (im lặng)', () async {
    final n = AuthNotifier(_FakeRepo(user: appUser), google: _FakeGoogle(null));
    final ok = await n.loginWithGoogle();
    expect(ok, isFalse);
    expect(n.error, isNull);
    expect(n.busy, isFalse);
  });

  test('BE lỗi (ApiException): false + error = message', () async {
    final n = AuthNotifier(
      _FakeRepo(error: ApiException('unauthorized', 'Invalid Google token')),
      google: _FakeGoogle('tok'),
    );
    final ok = await n.loginWithGoogle();
    expect(ok, isFalse);
    expect(n.error, 'Invalid Google token');
  });
}
