import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/api/api_endpoints.dart';
import 'package:novelverse/api/api_exception.dart';
import 'package:novelverse/api/token_store.dart';
import 'package:novelverse/data/repositories/auth_repository.dart';

/// ApiClient giả cho luồng Google login: postRaw trả response cấu hình được,
/// get (/auth/me) trả user map.
class _FakeApi extends ApiClient {
  _FakeApi({this.status = 200});
  final int status;
  String? lastPath;
  Object? lastBody;

  @override
  Future<Response<dynamic>> postRaw(String path, {Object? body, Map<String, String>? headers}) async {
    lastPath = path;
    lastBody = body;
    if (status >= 400) {
      return Response(
        requestOptions: RequestOptions(path: path),
        statusCode: status,
        data: {'error': {'code': 'unauthorized', 'message': 'Invalid Google token'}},
        headers: Headers(),
      );
    }
    return Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'data': {'ok': true, 'access_token': 'acc-1'}, 'meta': {}},
      headers: Headers.fromMap({'set-cookie': ['refresh_token=ref-1; Path=/; HttpOnly']}),
    );
  }

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query, bool raw = false}) async {
    return {'id': 'u1', 'email': 'a@b.c', 'displayName': 'A'};
  }
}

/// TokenStore giả — giữ token trong RAM, không đụng secure storage.
class _FakeStore extends TokenStore {
  String? access;
  String? refresh;
  @override
  Future<void> save({required String access, String? refresh}) async {
    this.access = access;
    this.refresh = refresh;
  }

  @override
  Future<String?> readAccess() async => access;
  @override
  Future<String?> readRefresh() async => refresh;
  @override
  Future<void> clear() async {
    access = null;
    refresh = null;
  }
}

void main() {
  test('loginGoogle: POST đúng path/body, lưu access + refresh(Set-Cookie), trả AppUser', () async {
    final api = _FakeApi();
    final store = _FakeStore();
    final repo = AuthRepository(api, store);

    final user = await repo.loginGoogle('id-token-123');

    expect(api.lastPath, ApiEndpoints.authGoogleMobile);
    expect(api.lastBody, {'idToken': 'id-token-123'});
    expect(store.access, 'acc-1');
    expect(store.refresh, 'ref-1');
    expect(user.email, 'a@b.c');
  });

  test('loginGoogle: BE 401 → ApiException, không lưu token', () async {
    final api = _FakeApi(status: 401);
    final store = _FakeStore();
    final repo = AuthRepository(api, store);

    await expectLater(repo.loginGoogle('bad'), throwsA(isA<ApiException>()));
    expect(store.access, isNull);
  });
}
