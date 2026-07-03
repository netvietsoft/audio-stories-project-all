# 01 — Kiến trúc & Bootstrap Backend (Audio Stories)

> MỤC ĐÍCH: Bản đồ kiến trúc tổng thể của backend NestJS. Đọc trước khi sửa
> bootstrap, config, logging, response format, hay deploy. Chi tiết module
> nghiệp vụ nằm ở các doc khác. File này dựa trên **đọc code thật** (2026-06-27).

═══════════════════════════════════════════════════════════════════════
## 1. TỔNG QUAN
═══════════════════════════════════════════════════════════════════════
Backend cho nền tảng **audio-stories** (truyện audio + nhạc + membership +
thanh toán). Stack:

- **NestJS 11** (`@nestjs/*` 11.x) + **Express** (`@nestjs/platform-express`)
- **Prisma 6** + **MySQL** (`PrismaService` ở `be/src/prisma/prisma.service.ts`)
- **Redis** (cache-manager + ioredis) — cache, throttler storage, health
- **Socket.IO** (`@nestjs/platform-socket.io`) — realtime (notifications)
- **Zod 4** — validate biến môi trường (`be/src/shared/config/app-config.schema.ts`)
- **nestjs-pino** — logging có correlation id
- **Swagger** — UI tại `/docs` (chỉ non-production)
- Tích hợp: Stripe, VietQR/Casso, Google OAuth, SMTP (nodemailer),
  Cloudflare R2 / AWS S3 / UploadThing (storage)

Tên package thật: `auth-be` (xem `be/package.json`). Port mặc định code = **3000**;
PM2 production chạy port **8035** (xem `ecosystem.config.js`).

Vị trí: `D:\SetupC\Projects\NovelApp\backend\be`

═══════════════════════════════════════════════════════════════════════
## 2. BA VAI (APP_ROLE): api / worker / scheduler
═══════════════════════════════════════════════════════════════════════
Cùng **một** codebase, **một** entrypoint `dist/main.js`, chạy 3 vai khác nhau
qua biến môi trường `APP_ROLE`. Logic ở `be/src/common/app-role.util.ts`.

| Vai        | HTTP server? | ScheduleModule? | Mô tả |
|------------|--------------|-----------------|-------|
| `api`      | CÓ (`app.listen`) | KHÔNG | Phục vụ REST + WebSocket + Swagger |
| `worker`   | KHÔNG (chỉ application context) | KHÔNG | Standalone context |
| `scheduler`| KHÔNG (chỉ application context) | CÓ (`ScheduleModule.forRoot()`) | Chạy cron `@Cron`/`@Interval` |

Cách phân nhánh (`be/src/bootstrap.ts`):
- `shouldStartHttpServer(role)` → chỉ `api` ⇒ `NestFactory.create()` + `app.listen()`.
- Vai khác ⇒ `NestFactory.createApplicationContext()` (không mở cổng).
- `buildScheduleImports(env)` (`app.module.ts` dòng 60) ⇒ chỉ thêm
  `ScheduleModule.forRoot()` khi role = `scheduler`. Nhờ vậy cron **không**
  chạy trùng trên cả api lẫn worker.

Mặc định khi không set `APP_ROLE`: `getAppRole` trả về `'api'`. Giá trị lạ ⇒ **throw**.

**Chạy dev theo vai** (qua `scripts/dev-role.cjs`):
- `yarn api:dev`       → APP_ROLE=api, **chạy migrate safe deploy trước**, rồi `nest start --watch`
- `yarn worker:dev`    → APP_ROLE=worker, chỉ `nest start --watch`
- `yarn scheduler:dev` → APP_ROLE=scheduler, chỉ `nest start --watch`
- `yarn start:dev` = alias của `yarn api:dev`.

**Production** (`ecosystem.config.js`, PM2): 3 process —
`auth-be` (api, cluster, port 8035), `auth-be-worker` (worker, fork),
`auth-be-scheduler` (scheduler, fork). Tất cả chạy `./dist/main.js`.

⚠ **CẠM BẪY / LỖI CẤU TRÚC**:
- **Vai `worker` hiện gần như rỗng.** Không thấy BullMQ/queue nào được đăng ký
  trong `app.module.ts` (không có `BullModule`). `worker` chỉ boot context full
  module rồi đứng yên — không tiêu thụ job nào. Nếu định dùng worker xử lý job
  nền thì **phần xử lý queue đang THIẾU** (chưa wire). (Trái với mô tả "BullMQ"
  ở các dự án khác — ở đây chưa có.)
- **Phần lớn module nghiệp vụ vẫn nạp ở mọi vai.** `AppModule` import tất cả
  controllers/providers cho cả 3 vai. Với worker/scheduler, controller HTTP
  không được mount (vì dùng application context) nhưng provider vẫn khởi tạo —
  có thể tốn tài nguyên / kết nối không cần thiết.

═══════════════════════════════════════════════════════════════════════
## 3. LUỒNG BOOTSTRAP (be/src/main.ts → bootstrap.ts)
═══════════════════════════════════════════════════════════════════════
`main.ts` chỉ gọi `void bootstrap()`. Toàn bộ thiết lập ở `bootstrap.ts`:

1. **Patch BigInt** (dòng 26-28): `BigInt.prototype.toJSON = () => this.toString()`
   để serialize BigInt sang JSON (Prisma trả nhiều cột BigInt). Patch global,
   chạy ngay khi import module.
2. Xác định role, log `Bootstrapping BE role: ...`.
3. Nếu là `api`:
   - `NestFactory.create(AppModule, { bufferLogs: true })`
   - `app.useLogger(app.get(PinoLogger))` — chuyển sang Pino
   - `app.enableShutdownHooks()`
   - `configureHttpApp(app, env)` (xem mục 4)
   - `app.listen(PORT ?? 3000, HOST ?? '0.0.0.0')`
   - Đăng ký handler `SIGTERM`/`SIGINT` → `app.close()` rồi `process.exit`.
4. Nếu là `worker`/`scheduler`: `createApplicationContext`, set logger Pino,
   enable shutdown hooks, đăng ký SIGTERM/SIGINT đóng context.

`bootstrap()` nhận `env` và `nestFactory` qua tham số (mặc định `process.env`,
`NestFactory`) ⇒ thuận tiện cho test.

═══════════════════════════════════════════════════════════════════════
## 4. CẤU HÌNH HTTP (configureHttpApp) — CHỈ vai api
═══════════════════════════════════════════════════════════════════════
Thứ tự thiết lập trong `bootstrap.ts` → `configureHttpApp`:

1. **Raw body cho Stripe webhook**: `app.use('/billing/webhook/stripe', json({ verify }))`
   gắn `req.rawBody = buf` để verify chữ ký Stripe. ⚠ Đặt **trước** parser khác.
   ⚠ Lưu ý: path là `/billing/webhook/stripe` — **KHÔNG có global prefix `/api`**
   (xem mục "Global prefix" bên dưới: code KHÔNG set global prefix).
2. **cookie-parser** — đọc JWT trong cookie.
3. **ValidationPipe** global: `{ whitelist: true, transform: true,
   forbidNonWhitelisted: false }` — loại field thừa, ép kiểu DTO, **không**
   reject field lạ.
4. **GlobalExceptionFilter** (mục 6) — bọc PinoLogger.
5. **ApiResponseInterceptor** (mục 5) — bọc mọi response `{ data, meta }`.
6. **Swagger** (`configureSwagger`): chỉ khi `NODE_ENV !== 'production'`, mount tại
   **`/docs`**. Title "Audio Stories BE". Có bearer + cookie auth (`refresh_token`).
7. **CORS**: `app.enableCors({ origin: <hàm>, credentials: true })`. Hàm dùng
   `collectAllowedOrigins` + `isCorsOriginAllowed` (`be/src/common/origin.util.ts`).
8. **Static `/uploads`**: tạo thư mục `cwd/uploads` nếu chưa có, serve tĩnh,
   set `Content-Type: image/webp` cho file `.webp`.

### Global prefix — QUAN TRỌNG, KHÁC dự án CRM
⚠ Backend này **KHÔNG** gọi `app.setGlobalPrefix('api')`. Route khai báo sao thì
đường dẫn thật như vậy: `@Controller('stories')` ⇒ `/stories` (KHÔNG `/api/stories`).
Health là `/healthz`, `/readyz`; Stripe webhook là `/billing/webhook/stripe`.
(Đừng nhầm sang quy ước `/api` của dự án CRM tham chiếu.)

═══════════════════════════════════════════════════════════════════════
## 5. ĐỊNH DẠNG RESPONSE: { data, meta }
═══════════════════════════════════════════════════════════════════════
`be/src/shared/http/api-response.interceptor.ts` + `api-response.ts`.

**Mọi response thành công** được bọc:
```jsonc
{ "data": <giá trị controller trả về>, "meta": { "requestId": "<uuid>" } }
```
`requestId` = `req.id` (correlation id, mục 7).

Kiểu (`api-response.ts`):
- `ApiSuccess<T>` = `{ data: T, meta: { requestId?, pagination? } }`
- `ApiError` = `{ error: { code, message, details? }, meta: { requestId? } }`
- `pagination`: `{ cursor?, nextCursor?, limit?, total? }`

⚠ **LỖI/THIẾU phát hiện**:
- Interceptor **không bao giờ** điền `meta.pagination` — field này có trong type
  nhưng controller phải tự nhét vào `data` hoặc tự build response; interceptor chỉ
  set `requestId`. Phân trang hiện không nhất quán ở tầng global.
- Frontend phải luôn bóc `res.data.data` (vì axios `res.data` = `{ data, meta }`).

═══════════════════════════════════════════════════════════════════════
## 6. EXCEPTION FILTER (chuẩn hoá lỗi)
═══════════════════════════════════════════════════════════════════════
`be/src/shared/http/global-exception.filter.ts` — `@Catch()` bắt tất cả. Trả
`ApiError` `{ error: { code, message, details? }, meta: { requestId } }`.

Thứ tự xử lý:
1. **DomainError** (`be/src/shared/kernel/domain-error.ts`): dùng
   `exception.code` + `exception.httpStatus`. Class trừu tượng, các lỗi nghiệp
   vụ kế thừa và khai `code`/`httpStatus`.
2. **Prisma.PrismaClientKnownRequestError**: map qua `PRISMA_MAP`:
   - `P1001` → 503 `DATABASE_UNAVAILABLE`
   - `P2002` → 409 `UNIQUE_CONSTRAINT_VIOLATION`
   - `P2025` → 404 `RECORD_NOT_FOUND`
   - `P2022` → 500 `SCHEMA_MISMATCH`
   - code khác → 500 `PRISMA_<code>`. **Log** ở mức error.
3. **HttpException** (Nest chuẩn): lấy status + message, code suy ra từ
   `statusToCode(status)` (BAD_REQUEST/UNAUTHORIZED/.../RATE_LIMITED). Message
   mảng (validation) được `join(', ')`.
4. Lỗi khác: 500 `INTERNAL_ERROR`, log error.

⚠ **CẠM BẪY**:
- Có **HAI** cơ chế map lỗi Prisma song song và KHÔNG đồng bộ:
  GlobalExceptionFilter (`PRISMA_MAP`, code dạng `UNIQUE_CONSTRAINT_VIOLATION`)
  và `be/src/common/utils/error-handler.util.ts` (`handlePrismaError`, ném
  `ConflictException`/`NotFoundException` của Nest, message tiếng Anh khác hẳn).
  Module nào gọi `handlePrismaError` sẽ ra message/format khác module dựa vào
  filter. **Nên gộp về một chỗ** (đề xuất bỏ `handlePrismaError`, để filter lo).
- `error-handler.util.ts` còn dùng `console.error` thay vì Pino ⇒ log không có
  correlation id, không bị redact.

═══════════════════════════════════════════════════════════════════════
## 7. LOGGING (nestjs-pino) + Correlation ID
═══════════════════════════════════════════════════════════════════════
- **Middleware** `CorrelationIdMiddleware` (`be/src/shared/logging/correlation-id.middleware.ts`),
  áp cho `*` (xem `app.module.ts` `configure()`): đọc header `x-request-id`
  (nếu là UUID hợp lệ thì dùng lại, không thì sinh `randomUUID()`), gán `req.id`,
  set lại header `x-request-id` trên response.
- **LoggerModule** (`be/src/shared/logging/logger.module.ts`): cấu hình
  `nestjs-pino` qua `forRootAsync` (đọc `AppConfigService`):
  - level: `info` (production) / `debug` (khác)
  - `genReqId`/`customProps` gắn `correlationId = req.id`
  - **autoLogging.ignore**: bỏ log cho `/healthz`, `/readyz`
  - **redact**: che `authorization`, `cookie`, `x-refresh-token`, body
    `password/newPassword/refreshToken/accessToken/token/code`, header
    `set-cookie` ⇒ `[REDACTED]`
  - transport `pino-pretty` (non-production), JSON thô (production)

⚠ Vì redact theo path cứng, nếu thêm field nhạy cảm mới (vd `otp`) phải cập nhật
danh sách thủ công.

═══════════════════════════════════════════════════════════════════════
## 8. CONFIG (Zod) — be/src/shared/config
═══════════════════════════════════════════════════════════════════════
- **`app-config.schema.ts`**: `RawEnvSchema` (Zod `looseObject`) validate `process.env`,
  rồi `parseAppConfig()` ánh xạ sang object `AppConfig` có cấu trúc theo nhóm
  (runtime/database/redis/auth/cors/mail/oauth/storage/payment/admin/rateLimit/testing).
- **Bắt buộc** (throw nếu thiếu/không hợp lệ): `APP_ROLE`, `NODE_ENV`,
  `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (≥32 ký tự),
  `INTERNAL_API_KEY` (≥16), `WEB_ORIGIN`, `ADMIN_ORIGIN`, `SMTP_HOST/PORT/FROM`,
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- **Default**: `HOST=0.0.0.0`, `PORT=3000`, `JWT_ACCESS_TTL=7d`,
  `JWT_REFRESH_TTL=30d`, `COOKIE_SAME_SITE=lax`, `COOKIE_SECURE=false`,
  `VIETQR_TEMPLATE=compact2`, `THROTTLE_DISABLED=false`, `STORAGE_PROVIDER=r2`.
- **Biến boolean** (`COOKIE_SECURE`, `SMTP_SECURE`, `THROTTLE_DISABLED`): nhận
  `true`/`false` dạng string hoặc boolean, transform về boolean.
- **Alias bị bỏ** (`LEGACY_ALIASES`): nếu môi trường còn `MAIL_FROM`,
  `VIETQR_DEFAULT_TEMPLATE`, `VIETQR_ACQ_ID`, `R2_SECRET_KEY_ID` ⇒ **throw** báo
  dùng tên chuẩn (SMTP_FROM, VIETQR_TEMPLATE, ...).
- **`app-config.service.ts`**: `AppConfigService` chỉ là wrapper getter quanh
  `AppConfig` (typed access).
- **`app-config.module.ts`** (`@Global`): tự `loadDotenv` (`.env.prod` nếu
  production, ngược lại `.env`), parse config **một lần ở thời điểm import module**,
  provide `AppConfigService` qua `useValue: new AppConfigService(config)`.

⚠ **CẠM BẪY / LỖI**:
- Config parse **tại import-time** (top-level của `app-config.module.ts`), KHÔNG
  trong factory ⇒ nếu thiếu env, app crash ngay khi load module, stack trace ít
  ngữ cảnh hơn. Đồng thời khó test (side-effect lúc import).
- **Trùng lặp đọc env**: `bootstrap.ts`/CORS/`origin.util.ts` đọc thẳng
  `process.env` (WEB_ORIGIN, FRONTEND_URL, ...) song song với `AppConfigService`.
  ⇒ Có hai "nguồn sự thật" cho cùng biến.
- `app.module.ts` (dòng 47-48) vẫn import `ConfigModule.forRoot({ isGlobal: true })`
  của `@nestjs/config` "tạm thời" — **kế hoạch migrate** sang `AppConfigService`
  chưa xong (ghi TODO trong code). Hiện hai hệ config cùng tồn tại.
- `parseAppConfig` map đầy đủ `storage`/`payment` nhưng **không** ép buộc khoá
  bắt buộc theo provider (vd chọn `STORAGE_PROVIDER=s3` mà thiếu AWS_* vẫn parse
  thành công) ⇒ lỗi chỉ lộ ở runtime khi upload.

═══════════════════════════════════════════════════════════════════════
## 9. HEALTH CHECK — be/src/shared/health
═══════════════════════════════════════════════════════════════════════
`HealthController` (`@nestjs/terminus`):
- `GET /healthz` — **liveness**, trả `{ status: 'ok' }` ngay (không kiểm tra phụ thuộc).
- `GET /readyz` — **readiness** (`@HealthCheck()`): ping `database` (Prisma) +
  `redis` (`RedisHealthIndicator`).

`RedisHealthIndicator` (`redis-health.indicator.ts`): tự tạo client `ioredis`
riêng (`maxRetriesPerRequest: 1`) ở `onModuleInit`, `PING` ở `pingCheck`, đóng ở
`onModuleDestroy`. ⚠ Client Redis này **tách biệt** với cache-manager redisStore
ở `app.module.ts` ⇒ hai kết nối Redis song song.

═══════════════════════════════════════════════════════════════════════
## 10. RATE LIMITING (Throttler)
═══════════════════════════════════════════════════════════════════════
- `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` (`app.module.ts`):
  100 req / 60s / IP, toàn cục.
- `CustomThrottlerGuard` (`be/src/common/guards/custom-throttler.guard.ts`) gắn
  global qua `APP_GUARD`:
  - `getTracker`: ưu tiên `req.ips[0]` (sau proxy), fallback `req.ip`,
    fallback header `x-forwarded-for`.
  - `THROTTLE_DISABLED=true` **chỉ** bỏ qua khi `NODE_ENV !== production`
    (production luôn bật).
  - **Fail-closed**: nếu throttler storage lỗi (vd Redis chết) ⇒ ném
    `ThrottlerException` (chặn) thay vì cho qua.

⚠ Tuy `ttl/limit` cấu hình tĩnh, nhưng storage mặc định của throttler ở đây là
**in-memory** (không thấy cấu hình `ThrottlerStorageRedisService`). ⇒ Trong PM2
cluster (api chạy nhiều instance/cluster mode) hoặc nhiều process, **giới hạn
không chia sẻ** giữa các process — mỗi process đếm riêng. Đây là **lỗi cấu hình**
cần lưu ý nếu scale ngang.

═══════════════════════════════════════════════════════════════════════
## 11. PRISMA
═══════════════════════════════════════════════════════════════════════
- `PrismaModule` (`@Global`) export `PrismaService`.
- `PrismaService extends PrismaClient`: `$connect` ở `onModuleInit`,
  `$disconnect` ở `onModuleDestroy`. (Tối giản — không có middleware/log query.)
- **Migrate**: `yarn prisma:migrate:deploy:safe` (`scripts/prisma-safe-migrate.cjs`)
  xử lý case migration legacy `20260413..._add_music_history_progress_seconds`:
  nếu cột `music_history.progress_seconds` đã tồn tại nhưng migration chưa đánh
  dấu applied ⇒ tự `prisma migrate resolve --applied` rồi `migrate deploy`. Dùng
  cho deploy an toàn khi DB từng bị thao tác thủ công.
- Dev: `api:dev` tự chạy migrate safe trước khi start (xem mục 2).

═══════════════════════════════════════════════════════════════════════
## 12. CÁCH CHẠY
═══════════════════════════════════════════════════════════════════════
**Yêu cầu**: Node 24.16.0 (engines), Yarn 4.15.0 (corepack), MySQL, Redis.
File env: `.env` (dev) / `.env.prod` (production). Biến bắt buộc xem mục 8.

**Dev**:
```
yarn install
yarn prisma:generate
yarn api:dev          # = APP_ROLE=api, migrate safe + nest start --watch
yarn worker:dev       # vai worker
yarn scheduler:dev    # vai scheduler (chạy cron)
```
Swagger dev: `http://<host>:<port>/docs`.

**Build/Prod**:
```
yarn build            # nest build → dist/
yarn start:prod       # node dist/main.js (đọc APP_ROLE từ env)
# hoặc PM2:
pm2 start ecosystem.config.js   # 3 process api(8035)/worker/scheduler
```

**Docker** (`be/Dockerfile`, multi-stage):
- `deps` (full install) → `build` (cài openssl trước `prisma:generate`,
  rồi `yarn build`) → `prod-deps` (`yarn workspaces focus --production`) →
  `runtime` (non-root `nestjs`, `dumb-init` PID 1, `EXPOSE 3000`,
  HEALTHCHECK gọi `/healthz`).
- ⚠ `yarn openapi` **cố ý bị bỏ** khỏi image build vì script này boot AppModule
  ⇒ CacheModule kết nối Redis (không có trong build container) ⇒ treo. Swagger
  runtime tại `/docs` vẫn hoạt động. `dist/openapi.json` chỉ là artifact CI.
- Pre-tạo `/app/uploads` thuộc user nestjs để `fs.mkdirSync` trong bootstrap
  không EACCES.

**Lệnh tiện ích**: `prisma:studio`, `prisma:seed`, `openapi` (sinh OpenAPI khỏi
runtime, cần Redis), `depcruise`/`depcruise:graph` (kiểm tra phụ thuộc),
`test`/`test:e2e*`.

═══════════════════════════════════════════════════════════════════════
## 13. KERNEL (be/src/shared/kernel) — tiện ích miền
═══════════════════════════════════════════════════════════════════════
- **`domain-error.ts`** — `abstract class DomainError extends Error` với
  `code`/`httpStatus` trừu tượng; được GlobalExceptionFilter ưu tiên xử lý.
- **`result.ts`** — `Result<T,E>` kiểu Rust (`ok`/`err`/`map`/`mapErr`/`unwrap`/
  `unwrapErr`/`isOk`/`isErr`). ⚠ Mức độ dùng thực tế trong codebase cần kiểm tra
  (có thể chỉ vài service dùng) — nếu ít dùng thì là code "khung" chưa lan tỏa.

═══════════════════════════════════════════════════════════════════════
## 14. TỔNG HỢP LỖI CẤU TRÚC/LOGIC CẦN REFACTOR
═══════════════════════════════════════════════════════════════════════
1. **Vai `worker` chưa làm gì** — thiếu hệ thống queue (BullMQ chưa wire).
2. **Hai hệ config song song**: `AppConfigService` (Zod) vs `@nestjs/config`
   `ConfigModule` (TODO migrate chưa xong) + đọc thẳng `process.env` rải rác.
3. **Hai cơ chế map lỗi Prisma**: GlobalExceptionFilter vs `handlePrismaError`
   (`common/utils/error-handler.util.ts`) — format/message khác nhau, nên gộp.
4. **Throttler in-memory** không chia sẻ giữa process/cluster.
5. **`meta.pagination`** khai báo trong type nhưng interceptor không bao giờ điền.
6. **`SerializeBigintInterceptor`** (`common/interceptors/...`) là **no-op**
   (chỉ `return next.handle()`), không serialize gì — việc serialize BigInt thực
   tế do patch `BigInt.prototype.toJSON` ở bootstrap đảm nhiệm. Interceptor này
   thừa/chết, nên xoá.
7. **BUG `slugify`** (`common/utils/slug.util.ts` dòng 14): regex
   `/[^a-z0-0\s-]/g` — `0-0` là typo (chỉ giữ ký tự `'0'`), **loại bỏ chữ số
   1-9** khỏi slug. Phải là `/[^a-z0-9\s-]/g`.
8. **Stripe webhook + health + tất cả route KHÔNG có prefix `/api`** — khác CRM,
   dễ nhầm khi cấu hình reverse proxy / frontend base URL.
9. Config không enforce ràng buộc theo `STORAGE_PROVIDER` ⇒ lỗi runtime tiềm ẩn.
