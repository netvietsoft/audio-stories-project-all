# Google Sign-In (Spec B) — Design

> Ngày: 2026-07-18 · App: NovelVerse Flutter + BE audio-stories · Trạng thái: design đã duyệt (approach A — google-auth-library), chờ user review spec → plan.
> Tiếp nối Spec A (Home v2). Web dreamtap.me ĐÃ login Google chạy → Google Cloud project + Web client ID sống trên prod; chỉ cần thêm Android OAuth client.

## 1. Luồng tổng

App bấm nút → `google_sign_in` v7 lấy `idToken` (audience = Web client ID sẵn có) → `POST /auth/google/mobile {idToken}` → BE verify → tái dùng `OAuthService.upsertGoogleUser` → `issueTokens` → response **y hệt `POST /auth/login`**: `{ok: true, access_token}` + refresh token trong Set-Cookie → app đi qua đường lưu token sẵn có của `AuthRepository` (đọc refresh từ Set-Cookie như login thường). Sau login: pull-merge history tự chạy (Home v2 đã wire theo AuthNotifier).

## 2. BE — repo/lineage & endpoint mới

- **Viết ở `D:\SetupC\Projects\NovelApp\backend-port\be`** (HEAD = origin/main = bản đang chạy dreamtap.me). User merge → push `main` → pull VPS như quy trình hiện tại. KHÔNG đụng web flow (`GET /auth/google` + `google-redirect` giữ nguyên).
- **Dep mới:** `google-auth-library` (lib chính chủ, verify idToken offline qua JWKS cache).
- **Endpoint:** `POST /auth/google/mobile` trong `auth.controller.ts`:
  - DTO `GoogleMobileDto {idToken: string}` (`@IsString() @IsNotEmpty()`).
  - Throttle như login (`limit 10 / 300s`), public (không guard), `@HttpCode(200)`.
  - Verify: `OAuth2Client.verifyIdToken({idToken, audience: GOOGLE_CLIENT_ID})` (env sẵn có — chính Web client ID). Lỗi verify (hết hạn/sai audience/chữ ký) → 401 `UnauthorizedException('Invalid Google token')`.
  - Map payload → `GoogleUserData`: `provider_user_id = payload.sub`, `email`, `name`, `avatar_url = payload.picture`, `raw = payload` (giữ `email_verified` cho check sẵn có trong `upsertGoogleUser` — email chưa verified → 401 như hiện tại).
  - Gọi `upsertGoogleUser(data, clientIp)` (đã xử lý: find-or-create theo email, **tự link account email/password cũ trùng email**, backfill displayName/avatar/googleId, tạo `OAuthAccount`, gán role mặc định, đánh dấu emailVerifiedAt) → `issueTokens(user.id)` → `setRefreshCookie` + `return {ok: true, access_token}`.
  - Verify logic đặt trong **`AuthService.verifyGoogleIdToken(idToken): Promise<GoogleUserData>`** (unit-test được với verifier mock; `OAuth2Client` khởi tạo 1 lần, lazy). Controller compose y hệt style `googleCallback` hiện có: verify → `upsertGoogleUser` → `issueTokens` → cookie + body.
- `GOOGLE_CLIENT_ID` thiếu/placeholder → endpoint trả 503 kiểu "Google login chưa cấu hình" (không crash).

## 3. App — dep, repo, notifier, UI

- **Dep mới DUY NHẤT:** `google_sign_in` v7 (bản mới nhất khi `pub add`; Dart SDK ^3.12.2 OK). API v7: `GoogleSignIn.instance.initialize(serverClientId: kGoogleServerClientId)` (1 lần, lazy) → `authenticate()` → `account.authentication.idToken`.
- `kGoogleServerClientId` = hằng trong `api_env.dart` (client ID là thông tin public, không phải secret) — giá trị lấy từ `GOOGLE_CLIENT_ID` trong be/.env.
- **`AuthRepository.loginGoogle()`**: gọi plugin lấy idToken (null → throw `ApiException` "Không lấy được Google token") → `POST /auth/google/mobile` → xử lý response + lưu token **đúng như `login()`** (tái dùng private helper hiện có nếu tách được; không đổi hành vi login thường).
- **`AuthNotifier.loginWithGoogle()`**: theo pattern `_run` sẵn có. **User hủy popup Google** (plugin throw `GoogleSignInException` code canceled) → return false NHƯNG không set `error` (thoát im lặng, không snackbar).
- **LoginScreen**: dưới nút đăng nhập hiện tại thêm divider "hoặc" + nút outlined "Tiếp tục với Google" (icon chữ G, style theo theme hiện có). Nút disable khi `busy`. Thành công → điều hướng y hệt login thường.

## 4. Việc tay user làm (checklist console — 1 lần)

1. Google Cloud Console → project hiện có (project của Web client dreamtap) → Credentials → **Create OAuth client ID → Android**:
   - Package name: `com.netviet.novelverse`
   - SHA-1: `F9:3B:89:75:64:85:DA:6E:DA:6F:E7:54:D1:39:4A:23:9F:D7:59:EA` (debug keystore — app hiện ký release bằng debug key nên 1 SHA-1 dùng cho cả dev lẫn release; sau này đổi keystore release thật thì thêm SHA-1 mới vào cùng client).
   - Android client KHÔNG cần secret, KHÔNG cần đổi code (chỉ cần tồn tại trong project để Google Play Services cho phép app lấy idToken).
2. Check `.env` VPS có `GOOGLE_CLIENT_ID` (web login đang chạy nên gần như chắc chắn có).
3. Deploy BE: merge nhánh port → push main → pull VPS → `yarn install --frozen-lockfile` (dep mới) → build + `pm2 restart audio-be && pm2 save`.

## 5. Lỗi & edge case

- User hủy popup → thoát im lặng (không error, không snackbar).
- Không mạng / BE down → snackbar lỗi như login thường (`_run` đã xử lý).
- idToken hết hạn/sai audience/giả → BE 401 "Invalid Google token" → snackbar.
- Google account email chưa verified → BE 401 (message hiện có của `upsertGoogleUser`).
- Trùng email với account email/password → tự link (hành vi sẵn có của `upsertGoogleUser`, giữ nguyên).
- Thiết bị không có Google Play Services → plugin throw → snackbar lỗi chung.

## 6. Test

- **BE unit** (`auth` spec hiện có pattern nào theo nấy): verify mock → map payload đúng field; token invalid → 401; thiếu GOOGLE_CLIENT_ID → 503. KHÔNG gọi Google thật trong test.
- **App test** `test/data/`: `loginGoogle` gửi đúng path/body, parse `{ok, access_token}` + Set-Cookie như login (fake ApiClient/plugin — plugin bọc sau interface mỏng để fake được).
- **Device pass A50s (BE prod, sau khi user deploy + tạo Android client):** login Google mới toanh (tạo user); login account Google có email trùng account thường (link); hủy popup (không snackbar); sau login → history pull-merge chạy (Home v2); logout → login lại OK.
- analyze 0 err/0 warn mới + full test không vỡ (app); lint/test BE pass.

## 7. Ngoài phạm vi

- Apple Sign-In / iOS config (app chỉ chạy Android hiện tại). Đăng xuất revoke Google session (chỉ clear token app như logout thường). Guest-sync history lên server. Màn Register riêng (app chỉ có LoginScreen). One-tap / silent sign-in tự động lúc mở app.

## 8. Quyết định đã chốt (2026-07-18)

1. Approach A: BE verify idToken bằng dep mới `google-auth-library`, audience = `GOOGLE_CLIENT_ID` (Web client) sẵn có.
2. BE viết ở lineage prod (`backend-port`, main); response endpoint mobile y hệt `/auth/login` để app tái dùng đường token.
3. App dùng `google_sign_in` v7 + `serverClientId` = Web client ID (hằng public trong api_env.dart).
4. User chỉ tạo thêm Android OAuth client (SHA-1 debug keystore đã trích sẵn ở §4).
5. Hủy popup = thoát im lặng, không hiện lỗi.
