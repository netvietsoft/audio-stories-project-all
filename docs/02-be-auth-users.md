# 02 — Backend: Auth + Users + RBAC

> MỤC ĐÍCH: Bản đồ + chi tiết toàn bộ luồng xác thực, phân quyền và quản lý user của backend NestJS
> (audio-stories monorepo). Đọc trước khi sửa bất cứ thứ gì liên quan login/token/role/permission.
> Nguồn: đọc code thật trong `be/src/auth/**` + `prisma/schema.prisma`. Cập nhật: 2026-06-27.

═══════════════════════════════════════════════════════════════════════
## 1. TỔNG QUAN — XÁC THỰC HOẠT ĐỘNG NHƯ THẾ NÀO
═══════════════════════════════════════════════════════════════════════

Cơ chế: **JWT 2 token** (access + refresh) + **Google OAuth** + **xác thực email bằng mã 6 số / link**.

- **Access token** (TTL mặc định `15m`, env `JWT_ACCESS_TTL`): chứa claims `{ sub, email, roles[], permissions[] }`.
  KHÔNG lưu DB. Gửi về client trong **body** response (`access_token`) — client tự lưu (localStorage)
  và gửi lại qua header `Authorization: Bearer ...`.
- **Refresh token** (TTL mặc định `30d`, env `JWT_REFRESH_TTL`): chứa `{ sub, jti }`.
  Lưu trong **cookie HttpOnly** `refresh_token` (không lộ cho JS). Mỗi refresh sinh 1 bản ghi
  `RefreshToken` trong DB với `jti` (UUID) duy nhất → rotate = xoá bản ghi cũ, tạo cặp mới.
- **Bí mật ký**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (2 secret KHÁC nhau). Lưu ý cả 2 đều
  fallback về chuỗi rỗng `''` khi thiếu env (xem CẠM BẪY §9).

Luồng đăng nhập local: `register` → gửi mã verify email → `verify-code`/`verify-email` → cấp token.
Luồng Google: `/auth/google` → Google → `/auth/google-redirect` → upsert user → cấp token →
redirect về FE kèm `access_token` trong query string.

**Nguồn lấy access token** (`jwt-access.strategy.ts`, theo thứ tự ưu tiên):
1. Header `Authorization: Bearer <token>`
2. Query param `?token=<token>` (dùng cho link verify-email/Google callback)
3. Cookie `access_token` (đọc cả `req.cookies.access_token` lẫn parse thủ công header `Cookie`)

> ⚠ LƯU Ý: code ĐỌC cookie `access_token` nhưng **không nơi nào trong auth SET cookie này** —
> chỉ refresh_token được set cookie. Access token luôn trả về body. Nhánh đọc cookie access_token
> hiện là dead-path (trừ khi client/proxy khác tự set). Xem §9.

═══════════════════════════════════════════════════════════════════════
## 2. CÁC FILE CHÍNH (be/src/auth/)
═══════════════════════════════════════════════════════════════════════

```
auth.controller.ts            → tất cả endpoint /auth/* (xem §3)
auth.service.ts               → facade: ủy quyền cho 6 service con + logic user/admin (GeoIP, stats…)
auth.module.ts                → wiring; import MailModule, PassportModule, JwtModule.register({})
types.ts                      → JwtAccessPayload, JwtRefreshPayload, JwtPayload, GoogleUser
refresh-cookie.options.ts     → tính CookieOptions cho refresh_token từ env (secure/sameSite/domain)

services/
  token.service.ts            → issueTokens / rotateRefresh / revokeAll / parseTTL
  user-claims.service.ts      → buildUserClaims (roles+permissions), getUserInfo, assignDefaultRole
  email-verification.service.ts → mã/link verify email, gửi mail, verify code
  password.service.ts         → forgot/reset password (mã 6 số)
  oauth.service.ts            → upsertGoogleUser (tạo/cập nhật user + OAuthAccount)
  url-helper.service.ts       → validate redirect_uri, build verify/reset link
  index.ts                    → re-export

strategies/
  jwt-access.strategy.ts      → passport 'jwt'; trích token từ Bearer/query/cookie; validate → load user từ DB
  jwt-refresh.strategy.ts     → passport 'jwt-refresh'; trích từ header x-refresh-token / cookie; validate trả nguyên payload
  google.strategy.ts          → passport 'google' (passport-google-oauth20)

guards/
  jwt-access.guard.ts         → AuthGuard('jwt') + bỏ qua nếu @Public()
  jwt-refresh.guard.ts        → AuthGuard('jwt-refresh')
  optional-jwt.guard.ts       → AuthGuard('jwt') nhưng KHÔNG throw (req.user=null nếu thiếu/invalid)
  roles.guard.ts              → kiểm tra @Roles(...) so với user.roles (case-insensitive)
  permissions.guard.ts        → kiểm tra @Permissions(...) so với user.permissions (AND, exact match)
  google-oauth.guard.ts       → khởi tạo passport google + nhúng redirect_uri vào OAuth state
  internal-api-key.guard.ts   → so header x-internal-api-key với env INTERNAL_API_KEY

decorators/
  account.decorator.ts        → @Account() = req.user
  roles.decorator.ts          → @Roles(...) (metadata key 'roles')
  permissions.decorator.ts    → @Permissions(...) (metadata key 'permissions')
  public.decorator.ts         → @Public() (metadata key 'isPublic')

dto/  → login, register, verify-email, verify-code, forgot, reset, update-me, check-premium,
        set-user-credits, account
```

Phụ thuộc ngoài auth:
- `@/common/oauth-client.util.ts` — `isAllowedRedirectUri`, `getDefaultClientUrl`,
  `getDefaultRedirectUri`, `buildOAuthState`, `parseOAuthState`, `getAllowedClientUrls`.
- `@/mail/mail.service.ts` — gửi mã/link (verify, reset).
- `@/prisma/prisma.service.ts` — DB.

═══════════════════════════════════════════════════════════════════════
## 3. ENDPOINT /auth/* — ROUTE + LOGIC
═══════════════════════════════════════════════════════════════════════

> Prefix toàn cục: kiểm tra `main.ts` (nếu có `setGlobalPrefix('api')` thì route thật là `/api/auth/...`).
> Trong tài liệu này ghi theo `@Controller('auth')`. Guard mặc định toàn cục CHỈ có throttler
> (`CustomThrottlerGuard` qua APP_GUARD trong `app.module.ts`); JWT guard áp THỦ CÔNG từng route.

| Method | Route | Guard | Body/Query | Logic chính |
|---|---|---|---|---|
| GET | `/auth/google` | GoogleOAuthGuard | `?redirect_uri` | Bắt đầu OAuth; nhúng redirect_uri (đã validate) vào `state` base64. Handler rỗng. |
| GET | `/auth/google-redirect` | AuthGuard('google') | `?state` | Callback Google. `upsertGoogleUser` → `issueTokens` → set cookie refresh → redirect về `getDefaultRedirectUri()` kèm `access_token`, `verified=true`, `redirect` (từ state). Lỗi → redirect `/auth-error`. |
| GET | `/auth/me` | JwtAccessGuard | — | Trả `getUserInfo(user.id)` + `_debug` (jwtPayload). |
| PATCH | `/auth/me` | JwtAccessGuard | UpdateMeDto | Cập nhật displayName/avatarUrl/allowEmailNoti/allowBellNoti → trả UserInfo. |
| POST | `/auth/refresh` | JwtRefreshGuard | cookie `refresh_token` hoặc header `x-refresh-token` | `rotateRefresh(old)` → set cookie refresh mới → body `{ ok, access_token }`. |
| POST | `/auth/logout` | JwtAccessGuard | — | `revokeAll(user.sub)` (xoá MỌI refresh token của user) → clearCookie → `{ ok:true }`. |
| POST | `/auth/register` | — | RegisterDto | Tạo/cập nhật user (argon2 hash), resolve country qua GeoIP, gán role mặc định, gửi mã verify. KHÔNG cấp token ngay. |
| POST | `/auth/login` | — | LoginDto | argon2.verify; CHẶN nếu `emailVerifiedAt` null; cập nhật lastLoginAt + backfill country → set cookie refresh → `{ ok, access_token }`. |
| GET | `/auth/verify-email` | — | `?token&redirect_uri` | Verify qua link; cấp token; set cookie refresh; redirect FE kèm `access_token`. |
| POST | `/auth/verify-email` | — | VerifyEmailDto `{token}` | Như trên nhưng trả JSON `{ ok, access_token }`. |
| POST | `/auth/resend-verify` | — | `{email, redirect_uri}` | Gửi lại LINK verify (token hash). Luôn `{ok:true}` kể cả email không tồn tại. |
| POST | `/auth/verify-code` | — | VerifyCodeDto `{email, code}` | Verify bằng mã 6 số → cấp token → set cookie → `{ ok, message, access_token }`. |
| POST | `/auth/resend-code` | — | `{email}` | Gửi lại MÃ 6 số. |
| POST | `/auth/forgot-password` | — | ForgotDto `{email, redirect_uri}` | Sinh mã reset 6 số, gửi mail. Luôn `{ok:true}` (chống user enumeration). |
| POST | `/auth/reset-password` | — | ResetDto `{email, code, newPassword}` | Verify mã reset → argon2 hash mật khẩu mới. |
| POST | `/auth/check-premium` | — | `{user_id}` | Trả `{ is_premium, premium_expires_at }` dựa vipTier>0 và vipExpirationDate. **KHÔNG có guard** (xem §9). |
| GET | `/auth/search-users` | JwtAccessGuard | `?email` | Tìm theo email/displayName (>=3 ký tự), tối đa 10. |
| GET | `/auth/users` | JwtAccessGuard + RolesGuard @Roles('ADMIN') | — | Danh sách user (kèm role, pulse, vip…). |
| GET | `/auth/admin/stats` | JwtAccess + Roles('ADMIN') | — | Thống kê: totalUsers, totalStories, monthlyRevenue, growth24h, recentUsers, recentReports. |
| GET | `/auth/users/:id` | JwtAccess + Roles('ADMIN') | — | Chi tiết 1 user kèm favorites/history/credits/payments/memberships/oauthAccounts. |
| PATCH | `/auth/users/:id/pulse` | JwtAccess + Roles('ADMIN') | SetUserPulseDto `{pulseBalance}` | Set thẳng pulseBalance (clamp >=0, floor). |

═══════════════════════════════════════════════════════════════════════
## 4. TOKEN — issue / rotate / revoke (token.service.ts)
═══════════════════════════════════════════════════════════════════════

- `issueTokens(userId)`:
  - access = ký `buildUserClaims(userId)` với `JWT_ACCESS_SECRET`, ttl `JWT_ACCESS_TTL||15m`.
  - refresh = ký `{sub, jti: randomUUID()}` với `JWT_REFRESH_SECRET`, ttl `JWT_REFRESH_TTL||30d`.
  - tạo bản ghi `RefreshToken { userId, jti, expiresAt }`. KHÔNG hash token (chữ ký JWT đã đảm bảo
    integrity; chỉ cần `jti` unique để chống replay → lookup O(1)).
- `rotateRefresh(oldToken)`:
  1. verify chữ ký (catch → 401). 2. tra `jti` trong DB (không thấy → 401, log cảnh báo replay).
  3. kiểm `record.userId === payload.sub`. 4. kiểm hết hạn (xoá + 401).
  5. xoá bản ghi cũ → `issueTokens` (rotation). KHÔNG có transaction (xem §9).
- `revokeAll(userId)`: `deleteMany` mọi refresh token của user (logout = revoke tất cả thiết bị).
- `parseTTL('30d')`: chỉ hỗ trợ regex `^(\d+)([smhd])$`. Giá trị lạ → 0ms (expiresAt = now → token chết ngay). Xem §9.

═══════════════════════════════════════════════════════════════════════
## 5. RBAC — ROLES & PERMISSIONS
═══════════════════════════════════════════════════════════════════════

**Mô hình**: mỗi `User` có đúng 1 `roleId` → 1 `Role`. `Role.permissions` là cột **JSON** (mảng string).
KHÔNG có bảng role-permission riêng, KHÔNG có user-permission trực tiếp. (Khác CRM tham chiếu: ở đây
1 user = 1 role, không multi-role.)

- `buildUserClaims(userId)` (user-claims.service.ts):
  - `roles = [user.role.name]` (LUÔN 1 phần tử).
  - `permissions = user.role.permissions` nếu là mảng, ngược lại `[]` (try/catch nuốt lỗi → log warn).
  - Trả `{ sub, email, roles, permissions }` → nhúng vào access token.
- **RolesGuard**: đọc `@Roles(...)`; nếu route không khai báo → cho qua. So sánh **không phân biệt hoa thường**
  (`.toUpperCase()`), `some()` → chỉ cần khớp 1 role. Nguồn role: `user.roles` hoặc `user.role.name`.
- **PermissionsGuard**: đọc `@Permissions(...)`; `every()` → user phải có **TẤT CẢ** permission yêu cầu;
  so khớp **chính xác chuỗi** (KHÔNG có alias/wildcard kiểu `MESSAGING_*` như CRM). user.permissions lấy
  từ JWT claim (đã ký lúc issue) → **đổi permission của role KHÔNG có hiệu lực tới khi user refresh/login lại**.

**Role mặc định**: slug `user`, name `USER`. `ensureDefaultUserRoleId()` (trong AuthService VÀ OAuthService —
trùng lặp, xem §9) upsert role này. `assignDefaultRole(userId)` set roleId. Lưu ý `User.roleId` default = `4`
trong schema (`prisma/schema.prisma:16`) — phụ thuộc seed; có thể lệch với id của role slug `user`. Xem §9.

**Guard nào đang dùng**: trong auth chỉ `JwtAccessGuard` + `RolesGuard('ADMIN')` được dùng thực tế.
`PermissionsGuard` được **export nhưng chưa controller nào dùng** (grep toàn `src`). `OptionalJwtGuard`
dùng ở `chapters.controller.ts` và `chapter-variants.controller.ts`. `InternalApiKeyGuard` chưa thấy dùng (stub-ready).

═══════════════════════════════════════════════════════════════════════
## 6. EMAIL VERIFICATION & RESET (email-verification.service.ts, password.service.ts)
═══════════════════════════════════════════════════════════════════════

- Bảng `AuthToken` (enum `AuthTokenType`: `VERIFY_EMAIL`, `VERIFY_CODE`, `PASSWORD_RESET`).
  `token` lưu **argon2 hash** của giá trị thật (mã/token), `isUsed`, `expiresAt`.
- **Mã 6 số** (`VERIFY_CODE`, `PASSWORD_RESET`): TTL 10 phút; sinh bằng `Math.random()` (KHÔNG crypto-secure, §9).
  Lưu mới = xoá hết mã cùng type của user rồi tạo (`deleteMany` + `create`).
- **Link token** (`VERIFY_EMAIL`): `crypto.randomBytes(32).hex`, TTL 24h. KHÔNG xoá token cũ trước khi tạo
  (tích lũy nhiều token).
- Verify: `findValidEmailToken`/`findValidVerificationCode` quét **findMany toàn bộ token cùng type** rồi
  `argon2.verify` từng cái trong vòng lặp → O(n) hash verify. Với VERIFY_EMAIL còn quét toàn bảng (không lọc user). §9.
- **Auto-verify khi không có SMTP** (`sendVerificationCode`): nếu `SMTP_HOST` rỗng → tự set
  `emailVerifiedAt` = now ngay lúc register (chế độ dev). Log mã ra console. → **dev bỏ qua verify**. §9.
- `forgotPassword`/`resendVerify*`: luôn trả `{ok:true}` kể cả email không tồn tại (chống user enumeration).
  Nhưng `resendVerificationCode` lại **throw BadRequest nếu email đã verify** → rò rỉ thông tin tồn tại email. §9.

═══════════════════════════════════════════════════════════════════════
## 7. GOOGLE OAUTH (google.strategy.ts, google-oauth.guard.ts, oauth.service.ts)
═══════════════════════════════════════════════════════════════════════

- Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
  (default `http://localhost:8000/auth/google-redirect`). Thiếu CLIENT_ID → dùng `'placeholder'` + warn
  (OAuth thực tế hỏng nhưng app vẫn boot).
- `GoogleOAuthGuard.canActivate`: validate `redirect_uri` (query) qua `isAllowedRedirectUri`; build `state`
  base64 chứa redirect_uri + timestamp; gọi `passport.authenticate('google', {state})` thủ công.
  `state` có hạn 10 phút (`parseOAuthState`).
- `validate` (strategy): map profile → `GoogleUser`; bắt buộc có email (không có → 401).
- `upsertGoogleUser`: tìm user theo email. Nếu chưa có → tạo (gán googleId, avatar, country GeoIP, role mặc định).
  Nếu có → backfill emailVerifiedAt/displayName/avatar/googleId/country (chỉ field còn trống). Tạo `OAuthAccount`
  nếu chưa tồn tại (`provider+providerUserId` unique).
- **Liên kết tài khoản theo EMAIL**: user đăng ký local rồi login Google cùng email → gộp vào 1 user
  (và auto-set emailVerifiedAt). Đây là quyết định thiết kế quan trọng — có rủi ro account takeover nếu email
  Google chưa được Google xác minh (code không kiểm `email_verified` từ Google). §9.

═══════════════════════════════════════════════════════════════════════
## 8. COOKIE & REDIRECT
═══════════════════════════════════════════════════════════════════════

- `refresh-cookie.options.ts`: `httpOnly:true`, `secure = COOKIE_SECURE || (NODE_ENV===production)`,
  `sameSite = COOKIE_SAME_SITE || 'lax'`, `path:'/'`, `maxAge=30 ngày`, `domain = COOKIE_DOMAIN` (nếu set).
  Clear options = bỏ `maxAge`.
  > ⚠ maxAge cookie cố định 30 ngày, KHÔNG đồng bộ với `JWT_REFRESH_TTL`. Lệch env → cookie sống lâu hơn/ngắn hơn token.
- Redirect cho phép: `isAllowedRedirectUri` — chấp nhận path nội bộ (`/...`) HOẶC origin nằm trong
  `getAllowedClientUrls()` (từ `collectAllowedOrigins` + `CLIENT_URL`).
- `cookie-parser`: strategy đọc `req.cookies` → app PHẢI bật `cookie-parser` middleware (kiểm tra `main.ts`).

═══════════════════════════════════════════════════════════════════════
## 9. LỖI CẤU TRÚC / LOGIC PHÁT HIỆN (để refactor)
═══════════════════════════════════════════════════════════════════════

**Bảo mật:**
1. **Secret fallback `''`** (token.service.ts:27,34): nếu thiếu `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`,
   token được ký bằng chuỗi rỗng → ai cũng giả mạo được. Phải throw lúc bootstrap nếu thiếu.
2. **`/auth/check-premium` không guard** (auth.controller.ts:228): nhận `user_id` tùy ý từ body, trả trạng thái
   premium của bất kỳ ai → rò rỉ + lạm dụng. Cần guard hoặc giới hạn theo user đăng nhập.
3. **Account linking qua email không kiểm `email_verified`** (oauth.service.ts): rủi ro chiếm tài khoản.
4. **Mã 6 số dùng `Math.random()`** (email-verification.service.ts:93): không crypto-secure, đoán được.
   Dùng `crypto.randomInt`.
5. **User enumeration không nhất quán**: forgot/resend-verify trả ok luôn, nhưng `resendVerificationCode`
   throw "Email already verified" → lộ email tồn tại.
6. **Auto-verify khi thiếu SMTP** (email-verification.service.ts:83): tiện cho dev nhưng nếu lỡ deploy prod
   thiếu SMTP_HOST → mọi user tự verify. Nên gắn cờ `NODE_ENV !== production`.
7. **`/auth/me` trả `_debug`** (jwtPayload: roles/permissions) ra response (auth.controller.ts:100) — nên bỏ ở prod.

**Logic / cấu trúc:**
8. **Cookie `access_token` được ĐỌC nhưng không nơi nào SET** (jwt-access.strategy.ts:18-32). Hoặc dead code,
   hoặc thiếu set cookie. Quyết định 1 hướng (Bearer-only hay cookie-based) cho rõ.
9. **Permission đóng băng trong JWT**: đổi `Role.permissions` không tác động user đang đăng nhập tới khi token
   hết hạn. RolesGuard load role từ DB (jwt-access.strategy.validate) nhưng PermissionsGuard lại dùng claim cũ
   → 2 guard không nhất quán nguồn dữ liệu.
10. **`ensureDefaultUserRoleId()` trùng lặp** ở `auth.service.ts:35` và `oauth.service.ts:21` (copy-paste).
    Nên đưa vào UserClaimsService hoặc 1 helper chung.
11. **`User.roleId` default=4** (schema) vs role slug `user` được upsert động → id có thể khác 4. Phụ thuộc thứ tự
    seed; user tạo trực tiếp (không qua flow) có thể trỏ role không tồn tại → `buildUserClaims` crash ở `user.role.name`.
12. **GeoIP backfill lặp 3 lần** (registerLocal/loginLocal/verifyEmail/verifyCode trong auth.service) — cùng đoạn
    check localhost/private + lookup. Tách thành helper `resolveCountry(ip)`.
13. **Verify token quét O(n) + argon2.verify vòng lặp** (email-verification.service.ts:111-140): VERIFY_EMAIL
    quét TOÀN bảng authToken (không lọc userId). Tốn CPU, không scale. Cân nhắc index theo lookup khác.
14. **rotateRefresh không atomic** (token.service.ts:90-91): delete cũ rồi issue mới ngoài transaction; nếu issue
    fail giữa chừng → mất cả phiên. Bọc `$transaction`.
15. **`getUserInfo` gọi `buildUserClaims` riêng** → 2 query user cho 1 request /me (user-claims.service.ts:70,87).
16. **`status: 'ACTIVE'` hardcode** (user-claims.service.ts:94) — field status đã bỏ khỏi schema; FE vẫn nhận ACTIVE
    cố định dù user có `isActive=false` (schema có cột `is_active` không được dùng để chặn login). Login KHÔNG kiểm `isActive`.
17. **`console.log` lẫn trong service** (auth.service.ts:295, oauth.service warns) — nên dùng Logger nhất quán.
18. **JwtModule.register({}) rỗng** — toàn bộ secret/ttl truyền thủ công mỗi lần sign. Có thể tập trung config.

═══════════════════════════════════════════════════════════════════════
## 10. PHẦN CÒN THIẾU / TODO
═══════════════════════════════════════════════════════════════════════

- KHÔNG có endpoint đổi mật khẩu khi đã đăng nhập (chỉ có forgot/reset qua email).
- KHÔNG có quản lý role/permission qua API (CRUD role, gán permission) — chỉ sửa DB tay/seed.
- KHÔNG có cơ chế khoá tài khoản (isActive không được kiểm khi login/validate).
- KHÔNG có rate-limit riêng cho login/forgot (chỉ throttler toàn cục) — dễ brute-force mã 6 số.
- KHÔNG có refresh-token-reuse detection thực sự (chỉ xoá jti; không revoke cả family khi phát hiện replay).
- `InternalApiKeyGuard`, `PermissionsGuard` đã viết nhưng chưa được áp ở đâu (chờ tích hợp).
- Email template/i18n: phụ thuộc MailService (ngoài vùng này).

═══════════════════════════════════════════════════════════════════════
## 11. SCHEMA LIÊN QUAN (prisma/schema.prisma)
═══════════════════════════════════════════════════════════════════════

- `User` (`users`): id uuid, email unique, passwordHash?, displayName, avatarUrl?, roleId(default 4),
  pulseBalance(map `credits`), googleId? unique, vipTier, vipExpirationDate?, emailVerifiedAt?,
  allowEmailNoti, allowBellNoti, country?, isActive, lastLoginAt?, deletedAt?(soft delete).
- `Role` (`roles`): id, name unique, slug unique, description?, **permissions Json?**, users User[].
- `RefreshToken` (`refresh_tokens`): jti unique, userId, expiresAt; KHÔNG lưu token thật.
- `AuthToken` (`auth_tokens`): type(enum), token(argon2 hash, unique), isUsed, expiresAt; index `[userId,type]`.
- `OAuthAccount` (`auth_oauth_account`): provider+providerUserId unique, profile Json?, userId.
- enum `AuthTokenType`: VERIFY_EMAIL | VERIFY_CODE | PASSWORD_RESET.

TÌNH TRẠNG TỔNG: **done** cho luồng cốt lõi (login/register/refresh/google/verify/reset/admin users).
Còn **partial** ở RBAC permission (guard chưa dùng, permission đóng băng trong JWT) và quản trị role.
