# Google Sign-In (Spec B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đăng nhập Google trên app Android: nút ở LoginScreen → `google_sign_in` v7 lấy idToken → `POST /auth/google/mobile` (endpoint BE mới) → phiên y hệt login thường.

**Architecture:** BE thêm 1 endpoint mỏng tái dùng toàn bộ hạ tầng OAuth sẵn có (`upsertGoogleUser` + `issueTokens` + refresh cookie); app thêm wrapper plugin mỏng (`GoogleAuth`) + 1 method repo + 1 method notifier + 1 nút UI. Không đụng web OAuth flow, không đổi login thường.

**Tech Stack:** NestJS (backend-port/be, yarn, jest) + `google-auth-library`; Flutter (novelverse) + `google_sign_in` v7.

**Spec:** `docs/superpowers/specs/2026-07-18-google-signin-design.md`

## Global Constraints

- **HAI repo, refspec push khác nhau:**
  - App: `D:\SetupC\Projects\NovelApp\novelverse` (branch `master`) → push `git push origin master:novelverse-master`.
  - BE: `D:\SetupC\Projects\NovelApp\backend-port` (branch `feat/reader-player-port` — lineage prod, HEAD = origin/main) → push `git push origin HEAD`. **KHÔNG push main** — user tự merge khi deploy.
- Dep mới: BE `google-auth-library`; app `google_sign_in` v7. KHÔNG dep nào khác.
- KHÔNG đụng: web OAuth flow (`GET /auth/google`, `GET /auth/google-redirect`), `POST /auth/login`/verify/refresh hiện có, `OAuthService.upsertGoogleUser`.
- Response `POST /auth/google/mobile` **y hệt** `/auth/login`: `{ok: true, access_token}` + refresh_token trong Set-Cookie (`setRefreshCookie`).
- `serverClientId` app = Web client ID sẵn có: `209816344286-s7vfrlvbktgieeqbeda7do4b5i25g0jp.apps.googleusercontent.com` (từ be/.env dev; bước user §Deploy phải xác nhận VPS `.env` có đúng `GOOGLE_CLIENT_ID` này — web login Google prod đang chạy nên gần như chắc chắn trùng).
- User hủy popup Google → thoát im lặng: KHÔNG set error, KHÔNG snackbar.
- Flutter KHÔNG trong PATH → `"/d/SetupC/flutter/bin/flutter.bat"` (bash). BE dùng `yarn` (cwd `backend-port/be`).
- Commit mỗi task, body kết `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, push ngay sau commit (refspec trên).

## Việc tay user (ngoài code — làm trước device pass)

1. Google Cloud Console → project của Web client dreamtap → Credentials → Create OAuth client ID → **Android**: package `com.netviet.novelverse`, SHA-1 `F9:3B:89:75:64:85:DA:6E:DA:6F:E7:54:D1:39:4A:23:9F:D7:59:EA`.
2. VPS: `grep GOOGLE_CLIENT_ID ~/projects-deploy/audio-stories-project-all/be/.env` — phải ra đúng giá trị ở Global Constraints.
3. Deploy BE sau khi merge: pull main → `yarn install --frozen-lockfile` (dep mới) → build → `pm2 restart audio-be && pm2 save`.

---

### Task 1: BE — `POST /auth/google/mobile` (verify idToken + cấp phiên)

**Files:**
- Modify: `D:/SetupC/Projects/NovelApp/backend-port/be/package.json` (qua `yarn add google-auth-library`)
- Create: `D:/SetupC/Projects/NovelApp/backend-port/be/src/auth/dto/google-mobile.dto.ts`
- Modify: `D:/SetupC/Projects/NovelApp/backend-port/be/src/auth/auth.service.ts` (thêm import + 2 method, KHÔNG sửa method sẵn có)
- Modify: `D:/SetupC/Projects/NovelApp/backend-port/be/src/auth/auth.controller.ts` (thêm 1 endpoint + 1 import)
- Test: `D:/SetupC/Projects/NovelApp/backend-port/be/src/auth/auth.service.google.spec.ts` (tạo mới)

**Interfaces:**
- Consumes (sẵn có): `AuthService.upsertGoogleUser(google: GoogleUserData, ip?): Promise<User>`; `AuthService.issueTokens(userId): Promise<TokenPair>`; `AuthController.setRefreshCookie(res, token)`; `GoogleUserData` (export từ `./services/oauth.service`).
- Produces: `POST /auth/google/mobile` body `{idToken: string}` → 200 `{ok: true, access_token}` + Set-Cookie refresh_token; 401 token sai/hết hạn/thiếu email verified; 503 khi `GOOGLE_CLIENT_ID` chưa cấu hình. `AuthService.verifyGoogleIdToken(idToken: string): Promise<GoogleUserData>` + seam test `protected getGoogleVerifier(): OAuth2Client`.

- [ ] **Step 1: Thêm dep**

```bash
cd "D:/SetupC/Projects/NovelApp/backend-port/be" && yarn add google-auth-library
```
Expected: package.json + yarn.lock có `google-auth-library`.

- [ ] **Step 2: Viết test thất bại** — tạo `src/auth/auth.service.google.spec.ts`:

```ts
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';

/** Subclass seam: thay verifier thật bằng fake — không gọi Google trong test. */
class TestAuthService extends AuthService {
  constructor(private readonly fakeVerify: (opts: unknown) => Promise<unknown>) {
    super(null as any, null as any, null as any, null as any, null as any, null as any);
  }
  protected getGoogleVerifier(): OAuth2Client {
    return { verifyIdToken: this.fakeVerify } as unknown as OAuth2Client;
  }
}

describe('AuthService.verifyGoogleIdToken', () => {
  const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  let envBackup: string | undefined;

  beforeEach(() => {
    envBackup = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  });
  afterEach(() => {
    if (envBackup === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = envBackup;
  });

  const payload = {
    sub: 'g-123',
    email: 'a@b.c',
    email_verified: true,
    name: 'Anh A',
    picture: 'https://p.example/a.jpg',
  };

  it('map payload hợp lệ → GoogleUserData (audience = GOOGLE_CLIENT_ID)', async () => {
    let seenOpts: any;
    const svc = new TestAuthService(async (opts) => {
      seenOpts = opts;
      return { getPayload: () => payload };
    });
    const out = await svc.verifyGoogleIdToken('tok-1');
    expect(seenOpts).toEqual({ idToken: 'tok-1', audience: CLIENT_ID });
    expect(out).toEqual({
      provider: 'google',
      provider_user_id: 'g-123',
      email: 'a@b.c',
      name: 'Anh A',
      avatar_url: 'https://p.example/a.jpg',
      raw: payload,
    });
    expect((out.raw as any).email_verified).toBe(true); // upsertGoogleUser cần cờ này
  });

  it('verifier throw (token sai/hết hạn) → UnauthorizedException', async () => {
    const svc = new TestAuthService(async () => {
      throw new Error('invalid signature');
    });
    await expect(svc.verifyGoogleIdToken('bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('payload rỗng/thiếu sub → UnauthorizedException', async () => {
    const svc = new TestAuthService(async () => ({ getPayload: () => undefined }));
    await expect(svc.verifyGoogleIdToken('tok')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('GOOGLE_CLIENT_ID thiếu/placeholder → ServiceUnavailableException', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const svc = new TestAuthService(async () => ({ getPayload: () => payload }));
    await expect(svc.verifyGoogleIdToken('tok')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
```

- [ ] **Step 3: Chạy test xác nhận FAIL**

Run: `cd "D:/SetupC/Projects/NovelApp/backend-port/be" && yarn test auth.service.google`
Expected: FAIL — `verifyGoogleIdToken is not a function` / TS compile error vì method chưa tồn tại.

- [ ] **Step 4: DTO** — tạo `src/auth/dto/google-mobile.dto.ts`:

```ts
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleMobileDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
```

- [ ] **Step 5: `AuthService.verifyGoogleIdToken`** — sửa `src/auth/auth.service.ts`.

Thêm import (cạnh các import @nestjs/common hiện có — file đã import `UnauthorizedException`; thêm `ServiceUnavailableException` vào cùng dòng import đó nếu chưa có, và import mới):

```ts
import { OAuth2Client } from 'google-auth-library';
```

Thêm 2 method vào class `AuthService` (đặt ngay dưới method `upsertGoogleUser` sẵn có ~dòng 58; `GoogleUserData` đã được import sẵn trong file cho `upsertGoogleUser` — nếu chưa thì thêm `import { GoogleUserData } from './services/oauth.service';`):

```ts
  private googleVerifier?: OAuth2Client;

  /** Seam cho unit test: test subclass override trả fake verifier. */
  protected getGoogleVerifier(): OAuth2Client {
    this.googleVerifier ??= new OAuth2Client();
    return this.googleVerifier;
  }

  /**
   * Verify Google idToken (mobile) → GoogleUserData cho upsertGoogleUser.
   * audience = GOOGLE_CLIENT_ID (Web client — app gửi serverClientId này).
   */
  async verifyGoogleIdToken(idToken: string): Promise<GoogleUserData> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'placeholder') {
      throw new ServiceUnavailableException('Google login is not configured');
    }
    let payload: Record<string, unknown> | undefined;
    try {
      const ticket = await this.getGoogleVerifier().verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload() as Record<string, unknown> | undefined;
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
    if (!payload || typeof payload.sub !== 'string' || !payload.sub) {
      throw new UnauthorizedException('Invalid Google token');
    }
    return {
      provider: 'google',
      provider_user_id: payload.sub,
      email: (payload.email as string | undefined) ?? null,
      name: (payload.name as string | undefined) ?? null,
      avatar_url: (payload.picture as string | undefined) ?? null,
      raw: payload, // giữ email_verified cho check trong upsertGoogleUser
    };
  }
```

- [ ] **Step 6: Endpoint** — sửa `src/auth/auth.controller.ts`.

> Lưu ý spec nói "throttle như login": trong lineage backend-port, `login` KHÔNG có decorator @Throttle riêng (rate-limit toàn cục lo) → endpoint mới cũng KHÔNG thêm — parity đúng nghĩa.

Thêm import: `import { GoogleMobileDto } from './dto/google-mobile.dto';`

Thêm endpoint (đặt ngay dưới `googleCallback`, trước `@Get('me')` — mirror style `login`):

```ts
  /** Đăng nhập Google từ mobile app: đổi idToken lấy phiên (response y hệt /auth/login). */
  @Post('google/mobile')
  @HttpCode(200)
  async googleMobile(@Body() dto: GoogleMobileDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const clientIp = ip ? ip.split(',')[0].trim() : undefined;

    const googleData = await this.auth.verifyGoogleIdToken(dto.idToken);
    const user = await this.auth.upsertGoogleUser(googleData, clientIp);
    const { access, refresh } = await this.auth.issueTokens(user.id);
    this.setRefreshCookie(res, refresh);
    return { ok: true, access_token: access };
  }
```

- [ ] **Step 7: Chạy test PASS + build sạch**

Run: `cd "D:/SetupC/Projects/NovelApp/backend-port/be" && yarn test auth.service.google && yarn build`
Expected: 4/4 PASS; build (tsc) 0 error. Chạy thêm full `yarn test` — suite cũ không vỡ.

- [ ] **Step 8: Commit + push**

```bash
cd "D:/SetupC/Projects/NovelApp/backend-port" && git add be/package.json be/yarn.lock be/src/auth && git commit -m "feat(auth): POST /auth/google/mobile — doi Google idToken lay phien (mobile app)" && git push origin HEAD
```
(Nhớ trailer Co-Authored-By trong body commit.)

---

### Task 2: App — dep + `GoogleAuth` wrapper + `AuthRepository.loginGoogle`

**Files:**
- Modify: `D:/SetupC/Projects/NovelApp/novelverse/pubspec.yaml` (qua `pub add`)
- Modify: `D:/SetupC/Projects/NovelApp/novelverse/lib/api/api_env.dart` (+1 const), `lib/api/api_endpoints.dart` (+1 const), `lib/data/repositories/auth_repository.dart` (+1 method)
- Create: `D:/SetupC/Projects/NovelApp/novelverse/lib/api/google_auth.dart`
- Test: `D:/SetupC/Projects/NovelApp/novelverse/test/data/auth_repository_google_test.dart` (tạo mới)

**Interfaces:**
- Consumes (sẵn có): `ApiClient.postRaw(String path, {Object? body, Map<String,String>? headers}) → Future<Response>`; helpers private của AuthRepository `_throwIfError/_persistFrom`; `TokenStore([FlutterSecureStorage?])` (subclass được); endpoint BE Task 1.
- Produces: `ApiEndpoints.authGoogleMobile = '/auth/google/mobile'`; `ApiEnv.googleServerClientId`; `class GoogleAuth { Future<String?> idToken() }` (null = user hủy; throw ApiException lỗi khác); `AuthRepository.loginGoogle(String idToken) → Future<AppUser>`. Task 3 dùng đúng các tên này.

- [ ] **Step 1: Thêm dep**

```bash
cd "D:/SetupC/Projects/NovelApp/novelverse" && "/d/SetupC/flutter/bin/flutter.bat" pub add google_sign_in
```
Expected: resolve `google_sign_in` 7.x (bản mới nhất).

- [ ] **Step 2: Viết test thất bại** — tạo `test/data/auth_repository_google_test.dart`:

```dart
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
```

- [ ] **Step 3: Chạy test xác nhận FAIL**

Run: `cd "D:/SetupC/Projects/NovelApp/novelverse" && "/d/SetupC/flutter/bin/flutter.bat" test test/data/auth_repository_google_test.dart`
Expected: FAIL compile — `authGoogleMobile`/`loginGoogle` chưa tồn tại.

- [ ] **Step 4: Consts** — `lib/api/api_endpoints.dart` thêm vào nhóm auth (sau `authLogin`):

```dart
  static const authGoogleMobile = '/auth/google/mobile';
```

`lib/api/api_env.dart` thêm vào class `ApiEnv` (cạnh `webBaseUrl` ~dòng 32):

```dart
  /// Web client ID Google OAuth (public, không phải secret) — audience BE verify.
  /// PHẢI trùng GOOGLE_CLIENT_ID trong .env BE prod.
  static const String googleServerClientId =
      '209816344286-s7vfrlvbktgieeqbeda7do4b5i25g0jp.apps.googleusercontent.com';
```

- [ ] **Step 5: `AuthRepository.loginGoogle`** — thêm method vào `lib/data/repositories/auth_repository.dart` ngay dưới `login()` (~dòng 25), tái dùng helpers sẵn có:

```dart
  /// Đăng nhập Google (mobile): đổi idToken từ google_sign_in lấy phiên như login thường.
  Future<AppUser> loginGoogle(String idToken) async {
    final res = await _api.postRaw(ApiEndpoints.authGoogleMobile, body: {'idToken': idToken});
    _throwIfError(res);
    await _persistFrom(res);
    return me();
  }
```

- [ ] **Step 6: `GoogleAuth` wrapper** — tạo `lib/api/google_auth.dart`:

```dart
import 'package:google_sign_in/google_sign_in.dart';

import 'api_env.dart';
import 'api_exception.dart';

/// Bọc google_sign_in v7 sau interface mỏng để AuthNotifier fake được trong test.
/// [idToken] trả null khi USER HỦY popup (không throw); lỗi khác → ApiException.
class GoogleAuth {
  bool _inited = false;

  Future<String?> idToken() async {
    try {
      final signIn = GoogleSignIn.instance;
      if (!_inited) {
        await signIn.initialize(serverClientId: ApiEnv.googleServerClientId);
        _inited = true;
      }
      final account = await signIn.authenticate();
      final token = account.authentication.idToken;
      if (token == null || token.isEmpty) {
        throw ApiException('google_no_token', 'Không lấy được Google token');
      }
      return token;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) return null;
      throw ApiException('google_${e.code.name}', 'Đăng nhập Google thất bại');
    }
  }
}
```
(Nếu API plugin bản resolve khác chi tiết trên — vd tên enum — sửa theo docs bản đó, GIỮ contract: hủy → null, lỗi → ApiException, thành công → idToken non-empty.)

- [ ] **Step 7: Test PASS + analyze**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/auth_repository_google_test.dart` → 2/2 PASS.
Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze lib test` → 0 error/warning mới.

- [ ] **Step 8: Commit + push**

```bash
cd "D:/SetupC/Projects/NovelApp/novelverse" && git add pubspec.yaml pubspec.lock lib/api lib/data/repositories/auth_repository.dart test/data/auth_repository_google_test.dart && git commit -m "feat(auth): GoogleAuth wrapper + AuthRepository.loginGoogle (POST /auth/google/mobile)" && git push origin master:novelverse-master
```

---

### Task 3: App — `AuthNotifier.loginWithGoogle` + nút Google ở LoginScreen

**Files:**
- Modify: `D:/SetupC/Projects/NovelApp/novelverse/lib/state/auth_notifier.dart`, `lib/screens/auth/login_screen.dart`
- Test: `D:/SetupC/Projects/NovelApp/novelverse/test/data/auth_notifier_google_test.dart` (tạo mới)

**Interfaces:**
- Consumes (Task 2): `GoogleAuth.idToken() → Future<String?>` (null = hủy); `AuthRepository.loginGoogle(String) → Future<AppUser>`.
- Produces: `AuthNotifier(repo, {GoogleAuth? google})` (main.dart KHÔNG cần sửa — param optional); `AuthNotifier.loginWithGoogle() → Future<bool>` (hủy → false + `error == null`).

- [ ] **Step 1: Viết test thất bại** — tạo `test/data/auth_notifier_google_test.dart`:

```dart
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
```

- [ ] **Step 2: Chạy test xác nhận FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/auth_notifier_google_test.dart`
Expected: FAIL compile — `google:` param và `loginWithGoogle` chưa tồn tại.

- [ ] **Step 3: `AuthNotifier`** — sửa `lib/state/auth_notifier.dart`:

Thêm import: `import '../api/google_auth.dart';`

Đổi constructor + field (dòng 13-14):

```dart
  AuthNotifier(this._repo, {GoogleAuth? google}) : _google = google ?? GoogleAuth();
  final AuthRepository _repo;
  final GoogleAuth _google;
```

Thêm method dưới `login` (~dòng 36):

```dart
  /// Đăng nhập Google. User hủy popup → trả false NHƯNG không set [error]
  /// (UI thoát im lặng, không snackbar).
  Future<bool> loginWithGoogle() async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      final idToken = await _google.idToken();
      if (idToken == null) return false; // user hủy
      user = await _repo.loginGoogle(idToken);
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
```

- [ ] **Step 4: Test PASS**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/auth_notifier_google_test.dart` → 3/3 PASS.

- [ ] **Step 5: LoginScreen** — sửa `lib/screens/auth/login_screen.dart`:

Thêm method dưới `_submit()` (~dòng 44):

```dart
  Future<void> _googleSignIn() async {
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthNotifier>();
    final ok = await auth.loginWithGoogle();
    if (!mounted) return;
    if (ok) {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/home');
      }
    }
  }
```

Trong `build()`, NGAY SAU `SizedBox` chứa nút "Đăng nhập" (kết thúc ~dòng 98), thêm vào list children:

```dart
          const SizedBox(height: Gap.lg),
          Row(children: [
            Expanded(child: Divider(color: pal.line)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.md),
              child: Text('hoặc', style: AppType.meta(size: 12, color: pal.muted)),
            ),
            Expanded(child: Divider(color: pal.line)),
          ]),
          const SizedBox(height: Gap.lg),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: BorderSide(color: pal.line),
                shape: RoundedRectangleBorder(borderRadius: rounded(12)),
              ),
              onPressed: auth.busy ? null : _googleSignIn,
              icon: Text('G', style: AppType.hero(size: 18, color: AppPalette.terracotta)),
              label: Text('Tiếp tục với Google', style: AppType.btn(color: pal.ink)),
            ),
          ),
```

- [ ] **Step 6: Full verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze lib test` → 0 error/warning mới.
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → full suite pass (79 cũ + 5 mới của Task 2-3).

- [ ] **Step 7: Commit + push**

```bash
cd "D:/SetupC/Projects/NovelApp/novelverse" && git add lib/state/auth_notifier.dart lib/screens/auth/login_screen.dart test/data/auth_notifier_google_test.dart && git commit -m "feat(auth): nut 'Tiep tuc voi Google' o LoginScreen + AuthNotifier.loginWithGoogle" && git push origin master:novelverse-master
```

---

### Task 4: Verify + docs

**Files:**
- Modify: `D:/SetupC/Projects/NovelApp/novelverse/CHANGELOG.md`, `lib/api/README.md`, `lib/screens/auth/README.md`

**Interfaces:** không có — task docs + verify cuối.

- [ ] **Step 1: Full verify 2 repo, dán số thật**

App: `"/d/SetupC/flutter/bin/flutter.bat" analyze lib test` (0 err/0 warn mới) + `flutter.bat test` (full pass).
BE: `cd "D:/SetupC/Projects/NovelApp/backend-port/be" && yarn test && yarn build` (suite pass, build 0 error).

- [ ] **Step 2: CHANGELOG.md** — thêm mục ngày 2026-07-18 (trên cùng, đúng format mục cũ):

```markdown
## 2026-07-18 — Đăng nhập Google (Spec B)

### App
- LoginScreen thêm nút "Tiếp tục với Google" (divider "hoặc"): `google_sign_in` v7 lấy idToken → `POST /auth/google/mobile` → phiên y hệt login thường (access body + refresh Set-Cookie). User hủy popup → thoát im lặng, không báo lỗi.
- Mới: `GoogleAuth` (lib/api/google_auth.dart — wrapper plugin, fake được trong test), `AuthRepository.loginGoogle`, `AuthNotifier.loginWithGoogle`, const `ApiEnv.googleServerClientId` + `ApiEndpoints.authGoogleMobile`.

### BE (backend-port, cần deploy + `yarn install`)
- Mới `POST /auth/google/mobile {idToken}`: verify bằng `google-auth-library` (audience = `GOOGLE_CLIENT_ID`), tái dùng `upsertGoogleUser` (tự link account trùng email, đòi email verified) + `issueTokens`. 401 token sai; 503 khi chưa cấu hình `GOOGLE_CLIENT_ID`.
- Việc tay 1 lần: tạo Android OAuth client (package `com.netviet.novelverse` + SHA-1 debug keystore) trong project Google Cloud hiện có — xem spec §4.
```

- [ ] **Step 3: README** — `lib/api/README.md` bảng Files thêm dòng (sau `token_store.dart`):

```markdown
| `google_auth.dart` | `GoogleAuth` — bọc `google_sign_in` v7 (`serverClientId` = `ApiEnv.googleServerClientId`), trả idToken; user hủy → null. |
```

`lib/screens/auth/README.md`: dòng bảng `login_screen.dart` đổi mô tả thành `LoginScreen — email + mật khẩu (POST /auth/login) + nút Google (POST /auth/google/mobile)`, và mục "Luồng" thêm dòng:

```markdown
- `auth.loginWithGoogle()` → idToken qua `GoogleAuth` → `POST /auth/google/mobile`; hủy popup → thoát im lặng (không error).
```

- [ ] **Step 4: Commit + push**

```bash
cd "D:/SetupC/Projects/NovelApp/novelverse" && git add CHANGELOG.md lib/api/README.md lib/screens/auth/README.md && git commit -m "docs: Google Sign-In (CHANGELOG + README api/auth)" && git push origin master:novelverse-master
```

---

## Sau plan (ngoài task — controller/user làm)

1. Final review toàn nhánh (2 repo) → fix wave nếu có.
2. User làm 3 bước tay (mục "Việc tay user" trên) + deploy BE.
3. Build APK prod + cài A50s + device pass theo spec §6: login Google mới; login email trùng account thường (link); hủy popup không snackbar; history pull-merge chạy sau login; logout → login lại.
