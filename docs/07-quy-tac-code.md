# 07 — Quy tắc code, cạm bẫy & kế hoạch refactor (Audio Stories)

> MỤC ĐÍCH: File "đọc TRƯỚC KHI SỬA CODE". Tổng hợp (a) quy tắc bắt buộc, (b) danh
> sách cạm bẫy, (c) danh sách lỗi cấu trúc/logic cần refactor (ưu tiên cao→thấp,
> kèm `file:vị trí`), (d) tham chiếu spec refactor trong `docs/superpowers/`.
> Dựa trên **đọc code thật** (cập nhật 2026-06-27). Tin code hơn tin doc nếu mâu thuẫn.
> Phạm vi: monorepo `D:\SetupC\Projects\NovelApp\backend` — `be/` (NestJS) + `fe/` (Next.js).

═══════════════════════════════════════════════════════════════════════
## A. QUY TẮC KHI SỬA CODE (đọc trước, làm theo)
═══════════════════════════════════════════════════════════════════════

### A1. Trước khi sửa
1. **Đọc doc vùng tương ứng trước**: `docs/01-kien-truc.md` (bootstrap/config/response/
   logging), `docs/02-be-*.md` (module nghiệp vụ), `docs/03-frontend-web.md`,
   `docs/04-database.md` (model + enum = nguồn sự thật cùng `be/prisma/schema.prisma`).
2. **Không có global prefix `/api`** ở backend này (KHÁC dự án CRM tham chiếu).
   `bootstrap.ts` KHÔNG gọi `setGlobalPrefix`. `@Controller('stories')` ⇒ `/stories`
   thật. Health = `/healthz`, `/readyz`. Stripe webhook = `/billing/webhook/stripe`.
   Đừng thêm `/api` vào FE base URL hay reverse proxy.
3. **enum/trạng thái = nguồn sự thật ở `be/prisma/schema.prisma`.** Trước khi so chuỗi
   trạng thái (StoryStatus, accessType, Order/Transaction status...), xem `docs/04`.
4. **APP_ROLE quyết định behavior**: cùng 1 codebase chạy 3 vai `api`/`worker`/`scheduler`
   (`be/src/common/app-role.util.ts`). Cron `@Cron`/`@Interval` CHỈ chạy ở vai
   `scheduler` (vì `ScheduleModule.forRoot()` chỉ thêm khi role=scheduler). Đừng cho
   rằng cron chạy trên `api`.

### A2. Khi viết/sửa response (BE)
5. **Mọi response thành công bị bọc `{ data, meta }`** bởi `ApiResponseInterceptor`
   (`be/src/shared/http/api-response.interceptor.ts`). Controller chỉ `return` payload
   thuần — KHÔNG tự bọc `{ data }` (sẽ thành `{ data: { data } }`).
6. **Lỗi nghiệp vụ**: ném `DomainError` (`be/src/shared/kernel/domain-error.ts`) với
   `code` ổn định để FE bind theo code. KHÔNG dùng message tiếng Anh ad-hoc.
   ⚠ KHÔNG dùng `handlePrismaError` (`be/src/common/utils/error-handler.util.ts`) cho
   code mới — nó là cơ chế map lỗi thứ hai, format/message khác filter (xem C2).
7. **Đừng `console.log/console.error`** — dùng Pino (`PinoLogger`/`Logger`) để có
   correlation id + redact. Field nhạy cảm mới (vd `otp`) phải thêm vào danh sách
   redact trong `be/src/shared/logging/logger.module.ts`.

### A3. Khi gọi API (FE)
8. **FE PHẢI tự bóc envelope**: axios `res.data` = `{ data, meta }`, payload thật ở
   `res.data.data`. Client chung `apps/web/src/lib/api/api-client.ts` KHÔNG có response
   interceptor bóc envelope ⇒ mỗi caller phải tự làm. Pattern hiện hỗn loạn:
   `res.data?.data || {}`, `res.data.data`, có chỗ đọc nhầm `res.data`. Khi thêm caller
   mới, **luôn** bóc `res.data.data` và xử lý fallback nhất quán (xem C5).
9. **Đừng truy cập DB trực tiếp từ FE.** FE chỉ gọi REST qua `NEXT_PUBLIC_API_URL`
   (default `http://localhost:3000`, xem `fe/packages/api-client/src/http.ts`).

### A4. Quy ước chung
10. **Path alias BE**: `@/` ⇒ `be/src/` (xem `jest.moduleNameMapper` + tsconfig).
11. **Env**: thêm biến mới phải khai trong Zod schema `be/src/shared/config/
    app-config.schema.ts` (nếu không, hoặc bị bỏ, hoặc throw). Biến bắt buộc xem
    `docs/01` mục 8. KHÔNG đọc thẳng `process.env` rải rác — dùng `AppConfigService`
    (dù hiện code còn vi phạm chính nguyên tắc này, xem C8).
12. **Sau khi sửa**: nếu đổi endpoint/model/enum/quy tắc ⇒ CẬP NHẬT doc tương ứng
    (`docs/02-*`, `docs/04`, hoặc file này). Không để doc lệch code.
13. **Slug**: dùng `slugify` (`be/src/common/utils/slug.util.ts`) — NHƯNG hiện đang lỗi
    (xem B-bug & C1). Nếu cần slug có chữ số, kiểm tra kết quả trước.

═══════════════════════════════════════════════════════════════════════
## B. DANH SÁCH CẠM BẪY (gotcha — dễ sai, không nhất thiết là bug)
═══════════════════════════════════════════════════════════════════════

| # | Cạm bẫy | Vị trí | Hệ quả nếu quên |
|---|---------|--------|------------------|
| B1 | KHÔNG có prefix `/api` | `be/src/bootstrap.ts` (không `setGlobalPrefix`) | Route sai khi config proxy / FE base URL |
| B2 | Response luôn bọc `{ data, meta }` | `be/src/shared/http/api-response.interceptor.ts` | FE bóc thiếu lớp ⇒ `undefined`; controller bọc dư ⇒ lồng 2 lớp |
| B3 | FE phải tự bóc `res.data.data` | `fe/apps/web/src/lib/api/api-client.ts` (không có interceptor unwrap) | Đọc nhầm `res.data` ⇒ luôn truthy nhưng sai shape |
| B4 | Cron chỉ chạy vai `scheduler` | `be/src/app.module.ts` (`buildScheduleImports`) | Tưởng cron chạy trên `api`/`worker` |
| B5 | Vai `worker` gần như RỖNG — chưa có queue consumer | `be/src/app.module.ts` (không có `BullModule`) | Tưởng job nền chạy ở worker; thực tế không |
| B6 | Redis BẮT BUỘC (cache + throttler storage + health) | `app.module.ts` `CacheModule` + `redis-health.indicator.ts` | Redis chết ⇒ throttler fail-closed CHẶN request (xem B12), `/readyz` đỏ |
| B7 | R2 BẮT BUỘC khi khởi tạo upload service | `be/src/upload/audio-upload.service.ts:40` (throw nếu thiếu config) | Thiếu `R2_*` ⇒ service ném ngay; bucket có dấu `_` ⇒ R2 từ chối (đã có message riêng) |
| B8 | Config parse tại **import-time** | `be/src/shared/config/app-config.module.ts` (top-level) | Thiếu env ⇒ crash lúc load module, stack ít ngữ cảnh; khó test |
| B9 | Legacy ENV alias bị THROW | `app-config.schema.ts` (`LEGACY_ALIASES`) | Còn `MAIL_FROM`/`VIETQR_DEFAULT_TEMPLATE`/`VIETQR_ACQ_ID`/`R2_SECRET_KEY_ID` ⇒ app không boot |
| B10 | Swagger CHỈ non-production, tại `/docs` (không `/api/docs`) | `bootstrap.ts` `configureSwagger` | Tìm Swagger sai path / không có ở prod |
| B11 | `yarn openapi` boot AppModule ⇒ cần Redis | `be/scripts/generate-openapi.ts` | Chạy trong container build (không Redis) ⇒ treo; đã cố ý loại khỏi Docker |
| B12 | Throttler fail-closed | `be/src/common/guards/custom-throttler.guard.ts` | Storage lỗi (Redis chết) ⇒ ném `ThrottlerException` chặn, KHÔNG cho qua |
| B13 | `THROTTLE_DISABLED` chỉ có tác dụng ngoài production | `custom-throttler.guard.ts` | Set ở prod vẫn bị giới hạn |
| B14 | Stripe webhook cần raw body, phải đặt parser TRƯỚC | `bootstrap.ts` `configureHttpApp` (`app.use('/billing/webhook/stripe', json({verify}))`) | Đảo thứ tự ⇒ verify chữ ký Stripe fail |
| B15 | BigInt serialize bằng patch global prototype | `bootstrap.ts:26` (`BigInt.prototype.toJSON`) | Đừng tin `SerializeBigintInterceptor` (no-op, xem C6) |
| B16 | Chapter `storyId` NULLABLE (chương mồ côi); `@@unique([storyId, chapterNumber])` | `be/prisma/schema.prisma` (Chapter) | Tạo chương trùng số trong 1 truyện ⇒ P2002 |
| B17 | Soft delete bằng `deletedAt` ở nhiều model (Story/Chapter/ChapterVariant) | `schema.prisma` | Query quên filter `deletedAt: null` ⇒ lộ bản ghi đã xoá |
| B18 | Dev `api:dev` tự chạy migrate safe trước khi start | `be/scripts/dev-role.cjs` + `prisma-safe-migrate.cjs` | Bất ngờ DB bị apply migration khi `yarn start:dev` |
| B19 | Auth dùng cookie HttpOnly + fallback Bearer/localStorage | `fe/.../lib/api/api-client.ts` (gắn `Authorization` từ localStorage) | Comment nói "cookie" nhưng access token vẫn lưu localStorage + gửi Bearer |
| B20 | Static `/uploads` serve local, KHÔNG scale ngang | `bootstrap.ts` (`app.use('/uploads')`) | Multi-instance/cluster ⇒ file local không chia sẻ |

═══════════════════════════════════════════════════════════════════════
## C. LỖI CẤU TRÚC / LOGIC CẦN REFACTOR (ưu tiên CAO → THẤP)
═══════════════════════════════════════════════════════════════════════

> Mỗi mục: mô tả · `file:vị trí` · đề xuất sửa. Đây là backlog refactor; spec tổng
> thể ở `docs/superpowers/specs/2026-06-13-be-refactor-design.md`.

### 🔴 ƯU TIÊN CAO

**C1 — BUG `slugify` loại bỏ chữ số 1-9**
- `be/src/common/utils/slug.util.ts:14`: regex `/[^a-z0-0\s-]/g`. `0-0` là typo
  (chỉ giữ ký tự `'0'`), **xoá mọi chữ số 1-9** khỏi slug.
- Sửa: `/[^a-z0-9\s-]/g`. Sau sửa kiểm lại slug đã sinh (story/music/author) có sai lệch.

**C2 — HAI cơ chế map lỗi Prisma song song, không đồng bộ**
- `be/src/shared/http/global-exception.filter.ts` (`PRISMA_MAP`, code dạng
  `UNIQUE_CONSTRAINT_VIOLATION`, có Pino log) VS
  `be/src/common/utils/error-handler.util.ts` (`handlePrismaError`, ném
  `ConflictException`/`NotFoundException` Nest, message tiếng Anh khác hẳn, dùng
  `console.error` ⇒ không correlation id, không redact).
- Module nào gọi `handlePrismaError` (vd `stories.service.ts:10`) ra format khác hẳn.
- Sửa: **bỏ `handlePrismaError`**, để GlobalExceptionFilter lo toàn bộ; gỡ import ở
  các service.

**C3 — God-services (vi phạm Single Responsibility + layering)**
- Service ôm cả validation + business + query Prisma + mapping, không có domain layer.
  - `be/src/chapters/chapters.service.ts` (~32KB)
  - `be/src/stories/stories.service.ts` (~31KB; controller chỉ là pass-through, xem
    `stories.controller.ts`)
  - `be/src/music/music.service.ts` (~31KB)
  - `be/src/user-features/user-features.service.ts` (~29KB)
  - `be/src/music/music-interaction.service.ts` (~19KB)
  - `be/src/chapter-comments/chapter-comments.service.ts` (~17KB)
  - `be/src/auth/auth.service.ts` (~15KB)
- Sửa: tách theo layered architecture (api / application use-case / domain /
  infrastructure repository+mapper) theo spec mục 1 & 4. Mục tiêu 0 file
  `*.service.ts` > 400 LOC.

**C4 — Schema Prisma 1 file lớn**
- `be/prisma/schema.prisma` (~45KB / ~1173 dòng) gom toàn bộ model + enum.
- Sửa: tách multi-file theo bounded context (`prisma/schema/*.prisma`) — spec mục 3
  (identity/catalog/music/engagement/monetization/billing/ads/tracking/settings +
  `_enums.prisma`). Validation gate: `prisma migrate diff` phải empty.

**C5 — BE wrap `{data}` vs FE unwrap KHÔNG nhất quán**
- BE luôn bọc `{ data, meta }` (`api-response.interceptor.ts`) nhưng FE client KHÔNG
  có interceptor bóc (`fe/apps/web/src/lib/api/api-client.ts`). Mỗi caller tự bóc tuỳ
  hứng: `res.data?.data || {}` (`StoryReader.tsx:474`), `res.data.data`
  (music-comments/music-interactions), có chỗ đọc thẳng `res.data`.
- Sửa: thêm **response interceptor unwrap** ở `apiClient` (trả thẳng `data`), hoặc tạo
  typed wrapper `unwrap<T>(res): T`. Chuẩn hoá toàn bộ caller. Đồng bộ contract qua
  OpenAPI (`yarn openapi` → `openapi.json`) để FE codegen.

### 🟠 ƯU TIÊN TRUNG BÌNH

**C6 — Vai `worker` chưa wire queue (thiếu hẳn hệ thống job nền)**
- `be/src/app.module.ts` không import `BullModule`; worker chỉ boot context rồi đứng
  yên. Mọi việc "nền" hiện chạy inline trong request (vd upload, mail).
- Sửa: wire BullMQ (producer ở `api`, consumer ở `worker`) — spec mục 6.6. Queue dự
  kiến: mail-send, webhook-process, audio-process, image-process, domain-events.

**C7 — `SerializeBigintInterceptor` là no-op (code chết)**
- `be/src/common/interceptors/serialize-bigint.interceptor.ts` chỉ
  `return next.handle()` — không serialize gì; việc serialize BigInt do patch
  `BigInt.prototype.toJSON` ở `bootstrap.ts` lo.
- Sửa: xoá interceptor + mọi reference.

**C8 — HAI hệ config song song + đọc `process.env` rải rác**
- `AppConfigService` (Zod) VS `ConfigModule.forRoot()` của `@nestjs/config`
  (`app.module.ts:47-48`, có TODO migrate chưa xong). Đồng thời `bootstrap.ts` /
  `be/src/common/origin.util.ts` đọc thẳng `process.env` (WEB_ORIGIN, FRONTEND_URL...).
- Sửa: hoàn tất migrate sang `AppConfigService`, gỡ `ConfigModule`, cấm đọc
  `process.env` ngoài tầng config.

**C9 — Config KHÔNG enforce ràng buộc theo provider**
- `app-config.schema.ts` `parseAppConfig` map đủ `storage`/`payment` nhưng không bắt
  buộc khoá bắt buộc theo `STORAGE_PROVIDER` (chọn `s3` mà thiếu `AWS_*` vẫn parse OK)
  ⇒ lỗi chỉ lộ runtime khi upload (so với R2 thì throw sớm ở C/B7).
- Sửa: thêm `superRefine` Zod theo `STORAGE_PROVIDER` để fail sớm lúc boot.

**C10 — Throttler storage in-memory, không chia sẻ giữa process/cluster**
- `app.module.ts` `ThrottlerModule.forRoot([{ttl,limit}])` không cấu hình
  `ThrottlerStorageRedisService` ⇒ mặc định in-memory. PM2 cluster (api nhiều instance)
  ⇒ mỗi process đếm riêng, giới hạn thực tế = limit × số process.
- Sửa: dùng Redis-backed throttler storage (đã có Redis sẵn).

**C11 — Hai kết nối Redis song song**
- `redis-health.indicator.ts` tự tạo client ioredis riêng, tách biệt với
  cache-manager redisStore ở `app.module.ts`.
- Sửa: dùng chung 1 provider Redis injectable.

### 🟡 ƯU TIÊN THẤP

**C12 — Node 24 spawn `.cmd` không `shell: true` (rủi ro Windows)**
- `be/scripts/dev-role.cjs:49` `spawn(yarnCommand, args, {...})` với
  `yarnCommand = 'yarn.cmd'` trên win32 nhưng KHÔNG đặt `shell: true`. Node ≥ 18.20.2 /
  20.12 / 21.7 (và 24.16 đang dùng) chặn spawn `.cmd`/`.bat` nếu thiếu `shell: true`
  ⇒ có thể `EINVAL`.
- Sửa: thêm `shell: true` (hoặc `windowsVerbatimArguments`/dùng `cross-spawn`) cho nhánh
  win32. Hiện chạy được có thể nhờ patch/biến môi trường — vẫn nên sửa cho bền.

**C13 — `meta.pagination` khai trong type nhưng không bao giờ điền**
- `be/src/shared/http/api-response.ts` định nghĩa `pagination`, nhưng
  `api-response.interceptor.ts` chỉ set `requestId`. Phân trang không nhất quán ở tầng
  global; mỗi controller tự nhét vào `data`.
- Sửa: chuẩn hoá phân trang qua interceptor/DTO (cursor cho list lớn, offset cho admin)
  — spec mục 4.5.

**C14 — `Result<T,E>` (kernel) ít/không lan toả**
- `be/src/shared/kernel/result.ts` đầy đủ nhưng phần lớn service vẫn throw exception cho
  business rule. Code "khung" chưa được dùng đúng định hướng (spec mục 1.4 muốn domain
  error dùng `Result`, không throw).
- Sửa: khi refactor từng module, chuyển business rule violation sang `Result`.

**C15 — `src/common/` (legacy) lẫn lộn với `src/shared/`**
- Tồn tại song song `be/src/common/*` (guards, utils, interceptors) và
  `be/src/shared/*` (kernel, http, config, logging). Spec muốn giải tán `common/` vào
  `shared/`.
- Sửa: di dời dần theo từng module refactor (spec mục 1.3, 5.5).

**C16 — Storage local `/uploads` còn tồn tại**
- `bootstrap.ts` serve tĩnh `cwd/uploads`. Không scale ngang; spec mục 6.4 muốn bỏ
  hẳn, đẩy 100% qua R2/UploadThing.

═══════════════════════════════════════════════════════════════════════
## D. THAM CHIẾU docs/superpowers (spec & plan refactor)
═══════════════════════════════════════════════════════════════════════

- **`docs/superpowers/specs/2026-06-13-be-refactor-design.md`** — Spec BE refactor đầy
  đủ: kiến trúc đích layered per module (mục 1), foundation Phase 0a (mục 2), schema
  modularization Phase 0b (mục 3), reference module Stories Phase 1 (mục 4), propagation
  27 module + thứ tự ưu tiên wave (mục 5), observability/scale/cleanup Phase 3 (mục 6),
  testing strategy + coverage gate (mục 7), risks/gates/timeline (mục 8).
- **`docs/superpowers/plans/2026-06-14-be-refactor-phase-0a-foundation.md`** — Plan chi
  tiết Phase 0a (foundation tối thiểu).
- **`docs/superpowers/specs/2026-06-10-audio-stories-fe-moonrepo-full-separation-design.md`**
  — Spec tách FE sang moonrepo (apps/web + packages: api-client/shared/ui).
- **`docs/superpowers/plans/2026-06-10-...full-separation-plan.md`** và
  **`...2026-06-11-...remaining-critical-phases-plan.md`** — Plan tách FE.
- **`docs/superpowers/repro/2026-06-10-fe-full-separation-baseline.md`** — Baseline
  trạng thái FE trước khi tách.

**Bản đồ liên quan**: `docs/01-kien-truc.md` (kiến trúc + bootstrap + config + response +
logging + health + throttler — đã ghi sẵn nhiều lỗi C ở trên), `docs/02-be-*.md`
(module nghiệp vụ), `docs/03-frontend-web.md`, `docs/04-database.md` (model + enum).

═══════════════════════════════════════════════════════════════════════
## E. CHECKLIST NHANH TRƯỚC KHI COMMIT
═══════════════════════════════════════════════════════════════════════
- [ ] Route mới KHÔNG tự thêm `/api`; đã test path thật.
- [ ] Controller `return` payload thuần (interceptor tự bọc `{data,meta}`).
- [ ] Lỗi nghiệp vụ dùng `DomainError` có `code`; KHÔNG `handlePrismaError`/`console.*`.
- [ ] FE caller bóc `res.data.data`, fallback nhất quán.
- [ ] Query có `deletedAt: null` nếu model soft-delete.
- [ ] Env mới khai trong Zod schema; không đọc thẳng `process.env`.
- [ ] Cron mới ý thức chỉ chạy vai `scheduler`.
- [ ] Đã cập nhật doc (`docs/02-*`/`docs/04`/file này) nếu đổi endpoint/model/enum/quy tắc.
