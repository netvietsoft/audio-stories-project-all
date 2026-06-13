# BE Refactor Design — Audio Stories

- **Date:** 2026-06-13
- **Scope:** Backend `/be` (NestJS 11 + Prisma 6 + MySQL 8 + Redis)
- **Goal:** Refactor BE đạt chuẩn production, dễ maintain, dễ upgrade về sau.
- **Approach:** Vertical slice first — Foundation tối thiểu → Schema modularization → Refactor module Stories làm reference → Propagate pattern cho 27 module → Observability & cleanup.
- **Status:** Draft — pending user review before invoking writing-plans.

---

## 0. Bối cảnh & ràng buộc

### 0.1 Hiện trạng

- Stack: NestJS 11, TypeScript, Prisma 6, MySQL 8, Redis, Yarn 4.15, Node 24.16.
- 28 feature modules: `stories`, `chapters`, `chapter-variants`, `music`, `billing` (Stripe/VietQR), `tracking`, `memberships`, `auth` (JWT + Google OAuth), `upload` (R2/UploadThing), `notifications` (Socket.io), `comments`, `chapter-comments`, `reviews`, `ads`, `mail`, `transactions`, `packages`, `stats`, `banners`, `categories`, `authors`, `languages`, `settings`, `social-links`, `user-features`, `personal-playlist`, `prisma`, `common`.
- 3 runtime roles đã tách: `api`, `worker`, `scheduler`. `api` chạy HTTP + REST. `scheduler` sở hữu cron. `worker` chưa có queue consumer.
- 218 file TS, ~1.4MB source.
- E2E tests: `auth`, `rbac`, `chapters`, `chapter-unlock-tracking`, `tracking-rate-limit`, `app`.

### 0.2 Các vấn đề định danh

| Khía cạnh | Tình trạng | Mức cấp bách |
|---|---|---|
| God-services | `stories.service.ts` 1098 LOC, `music.service.ts` 939, `user-features.service.ts` 937, `chapters.service.ts` 847, `music-interaction.service.ts` 709, `chapter-comments.service.ts` 620, `auth.service.ts` 491 | Cao |
| Schema Prisma | 1173 dòng trong 1 file | Cao |
| Layering | Service ôm validation + business + DB + mapping; không có domain layer rõ | Cao |
| Production hardening | Có Throttler, CORS, PM2 3-role, safe migrate; thiếu structured logging, health endpoint chuẩn, OpenAPI, Docker, CI, metrics, tracing | Trung bình |
| Storage | Local `/uploads` serve static, không scale ngang | Trung bình |
| Test coverage | Có e2e cho auth/rbac/chapters/tracking; gần như không có unit test cho business logic | Trung bình |
| Legacy ENV aliases | `MAIL_FROM`, `VIETQR_DEFAULT_TEMPLATE`, `VIETQR_ACQ_ID`, `R2_SECRET_KEY_ID` | Thấp |

### 0.3 Ràng buộc (đã xác nhận)

- **Production status:** Chưa deploy. Chỉ chạy local/staging. Không có user thật, không có data thật cần migrate.
- **API contract freedom:** Tự do đổi. FE (web + admin) refactor song song, sẵn sàng update theo contract mới.
- **Team:** 1 dev maintain chính (theo git history).
- **Timeline:** Không có deadline cứng. Estimate ~4-5 tháng full-time.

### 0.4 Mục tiêu

1. Tách god-services thành layered architecture (controller / use-case / repository / domain / mapper).
2. Production-readiness: logging, health, OpenAPI, Docker, CI, error envelope, graceful shutdown, observability.
3. Dễ maintain bởi 1 dev: pattern thống nhất, test pyramid lành mạnh, doc đầy đủ.
4. Dễ upgrade: bounded context rõ, dependency direction rõ, không leak Prisma type ra ngoài infrastructure.

---

## 1. Kiến trúc đích — Layered architecture per module

### 1.1 Cấu trúc folder chuẩn cho mỗi feature module

```
src/modules/<feature>/
├── api/                                # Tầng I/O — Nest controllers, DTO
│   ├── <feature>.controller.ts         # Public route
│   ├── <feature>.admin.controller.ts   # Admin route (nếu có)
│   └── dto/
│       ├── create-<x>.dto.ts           # class-validator + decorator OpenAPI
│       ├── update-<x>.dto.ts
│       └── <x>-response.dto.ts
│
├── application/                        # Tầng orchestration — use-cases
│   ├── use-cases/                      # 1 file = 1 flow business
│   │   └── <action>-<x>.use-case.ts
│   ├── ports/                          # Interface mà use-case depend vào
│   │   ├── <x>.repository.port.ts
│   │   └── <external>.port.ts
│   └── queries/                        # Read-model queries (CQRS-lite, optional)
│
├── domain/                             # Tầng rules thuần — KHÔNG biết Prisma/Nest
│   ├── entities/
│   │   └── <x>.entity.ts
│   ├── value-objects/
│   └── errors/
│       └── <x>.errors.ts
│
├── infrastructure/                     # Adapters cụ thể
│   ├── persistence/
│   │   ├── <x>.prisma.repository.ts    # implements <x>.repository.port
│   │   └── <x>.prisma.mapper.ts        # Prisma model ↔ Domain entity
│   └── external/                       # Stripe/VietQR/UploadThing adapters (nếu có)
│
├── <feature>.module.ts                 # Wiring Nest DI
└── __tests__/
    ├── unit/                           # Domain + use-case (mock ports)
    └── integration/                    # Repository + DB thật
```

### 1.2 Quy ước phân tầng nghiêm ngặt

| Layer | Được phép import | KHÔNG được import |
|---|---|---|
| `domain/` | Stdlib + value-objects nội bộ | Nest, Prisma, axios, fs, mọi I/O |
| `application/` | `domain/`, `ports/` | Prisma trực tiếp, controller, HTTP req/res |
| `infrastructure/` | `domain/`, `application/ports`, Prisma, SDK external | Controller, DTO |
| `api/` | `application/use-cases`, DTO, domain types (read-only) | Prisma trực tiếp, infrastructure |

Enforce bằng **ESLint `no-restricted-imports`** + **dependency-cruiser** trong CI. Vi phạm = block PR.

### 1.3 Shared kernel — `src/shared/`

```
src/shared/
├── kernel/                  # Base domain types
│   ├── result.ts            # Result<T, E>
│   ├── pagination.ts
│   └── entity-id.ts
├── http/
│   ├── api-response.ts      # { data, meta, error } envelope
│   ├── http-exception.filter.ts
│   └── pagination.interceptor.ts
├── prisma/
│   ├── prisma.service.ts
│   └── unit-of-work.ts
├── auth/
│   ├── current-user.decorator.ts
│   └── roles.guard.ts
├── logging/                 # Pino logger module + correlation-id
├── config/                  # Typed config (zod-validated env)
└── testing/                 # Test factories, builders, e2e helpers
```

`src/common/` legacy folder sẽ được **giải tán dần** trong Phase 2, chuyển sang `src/shared/`.

### 1.4 Quy ước domain error

- **Domain error:** sử dụng `Result<T, E>` — không throw. Tránh exception flow cho business rule violation.
- **Infrastructure error:** throw bình thường (DB connection mất, external API down). Global exception filter map sang 5xx.
- **API contract:** mọi domain error có `code` ổn định (FE bind theo code, không theo message).

### 1.5 Quy ước Value Object

- Chỉ tạo VO khi có **invariant thực sự** (ví dụ `Price` không âm, `Slug` đúng regex, `StoryStatus` enum).
- Không VO hoá mọi field. Field thường giữ primitive trong entity.

---

## 2. Foundation tối thiểu (Phase 0a)

### 2.1 Typed config + env validation

- `src/shared/config/` chứa `AppConfig` zod-validated. Boot fail nếu env thiếu/sai.
- Tách config thành nhóm: `auth`, `database`, `redis`, `mail`, `storage`, `payment`, `runtime`, `cors`. Module inject nhóm nó cần.
- Drop legacy aliases: `MAIL_FROM`, `VIETQR_DEFAULT_TEMPLATE`, `VIETQR_ACQ_ID`, `R2_SECRET_KEY_ID`.

### 2.2 Structured logging — Pino

- `nestjs-pino` global. JSON ở prod, pretty ở dev.
- Correlation-id sinh / nhận từ `x-request-id`, gắn mọi log line cùng request.
- Cron job logger context có `job_name`.
- PII scrubber: không log email, password, token, refresh-token, JWT.

### 2.3 Error envelope + global exception filter

Success:
```json
{ "data": <payload>, "meta": { "requestId": "...", "pagination": {...} } }
```

Error:
```json
{ "error": { "code": "CHAPTER_NOT_FOUND", "message": "...", "details": {...} },
  "meta": { "requestId": "..." } }
```

- `GlobalExceptionFilter` map `DomainError` → 4xx, `Prisma*` → 4xx/5xx, unknown → 500 + full stack log.

### 2.4 OpenAPI / Swagger

- `@nestjs/swagger` tại `/docs` (dev/staging). Disable hoặc basic-auth ở prod.
- Response DTO bắt buộc khai báo — không response thẳng Prisma entity (chống leak field).
- Build sinh `openapi.json` artifact cho FE codegen.

### 2.5 Health & readiness

- `@nestjs/terminus`: `/healthz` (liveness) + `/readyz` (readiness — check DB + Redis).

### 2.6 ESLint architectural rules + dependency-cruiser

- `no-restricted-imports` enforce Section 1.2.
- `dependency-cruiser` chạy trong CI, fail PR khi vi phạm.

### 2.7 Docker + CI tối thiểu

- `Dockerfile` multi-stage (deps → build → runtime). Node 24-slim, non-root user, healthcheck.
- `docker-compose.dev.yml`: app + MySQL + Redis.
- CI workflow: `lint` → `typecheck` → `unit-test` → `dependency-cruiser` → `build`.

### 2.8 Graceful shutdown

- `app.enableShutdownHooks()` + handle `SIGTERM`/`SIGINT`.
- Mỗi role drain inflight, close Prisma + Redis, exit clean.

### 2.9 Lib chọn

- **Logger:** Pino.
- **Config validation:** Zod.
- **Queue (Phase 3):** BullMQ.
- **Test container (Phase 1+):** testcontainers-node với MySQL ephemeral.

---

## 3. Schema modularization (Phase 0b)

### 3.1 Mục tiêu

Tách `schema.prisma` 1173 dòng thành multi-file theo bounded context (Prisma 5.15+ feature, ổn định ở 6.0.0 đang dùng).

### 3.2 Cấu trúc đề xuất

```
prisma/
├── schema/
│   ├── _generator.prisma           # generator client
│   ├── _datasource.prisma          # datasource db
│   ├── _enums.prisma               # gom enum
│   ├── identity.prisma             # User, Role, Session, OAuthAccount, EmailVerification
│   ├── catalog.prisma              # Story, Chapter, ChapterVariant, Category, Author, Language, Tag
│   ├── music.prisma                # Music, MusicComment, MusicInteraction, Playlist
│   ├── engagement.prisma           # Review, Comment, ChapterComment, Notification, Banner
│   ├── monetization.prisma         # Package, Membership, Transaction, UserChapterUnlock, Pulse
│   ├── billing.prisma              # StripeEvent, VietQrTransaction, WebhookEvent
│   ├── ads.prisma                  # Ad, AdView, AdClick
│   ├── tracking.prisma             # TrackingEvent, RateLimitState
│   └── settings.prisma             # Setting, SocialLink, UserFeature
├── migrations/                     # giữ nguyên
├── seed.ts
├── seed-music.ts
└── update-dates.ts
```

### 3.3 Nguyên tắc tách

- 1 bounded context = 1 file.
- Model đặt ở file nơi nó được sở hữu.
- Relation cross-context khai báo từ 1 phía.
- Enum gom 1 file (`_enums.prisma`).
- Index/constraint khai báo ngay sau model.

### 3.4 Validation gate

1. `prisma format` clean.
2. `prisma generate` không lỗi.
3. `prisma migrate diff --from-schema-datamodel ./schema --to-migrations ./migrations` **phải empty**. Có diff = sai semantic.
4. `prisma db pull --print` identical với DB hiện tại.
5. E2e suite hiện có pass.

### 3.5 Phụ — drop legacy ENV aliases

Vì chưa deploy production, drop dứt khoát: `MAIL_FROM`, `VIETQR_DEFAULT_TEMPLATE`, `VIETQR_ACQ_ID`, `R2_SECRET_KEY_ID`. Update `.env.example`, `.env`, `.env.prod`, code reference. Zod-config báo lỗi nếu env cũ còn set. Commit độc lập, không gộp với schema split.

### 3.6 Không làm ở phase này

- Đổi tên model/field (sẽ rải trong Phase 2, cùng commit với module đó).
- Soft-delete normalization.
- Index optimization preemptive.

---

## 4. Reference module — refactor Stories (Phase 1)

### 4.1 Lý do chọn Stories

- Lớn nhất (1098 LOC).
- Central nhất — hầu hết module khác liên đới.
- Đa dạng pattern nhất: CRUD admin, list public filter/sort, pricing/discount/unlock, aggregation từ chapters.

### 4.2 Phân rã `stories.service.ts` thành use-cases

Flows dự kiến (sẽ xác nhận khi đọc code):

| Flow | Use-case |
|---|---|
| Tạo story (admin) | `CreateStoryUseCase` |
| Cập nhật story (admin) | `UpdateStoryUseCase` |
| Xoá / publish / unpublish | `ChangeStoryStatusUseCase` |
| List story public | `ListPublicStoriesUseCase` |
| List story admin | `ListAdminStoriesUseCase` |
| Get chi tiết story public | `GetStoryDetailUseCase` |
| Get chi tiết story admin | `GetAdminStoryDetailUseCase` |
| Tính giá / discount | `CalculateStoryPricingUseCase` |
| Unlock toàn bộ story | `UnlockStoryUseCase` |
| Unlock story via ads | `UnlockStoryByAdsUseCase` |
| Search story | `SearchStoriesUseCase` |
| Aggregate stats per story | `GetStoryStatsUseCase` |

Mỗi use-case mục tiêu 30-150 LOC.

### 4.3 Cấu trúc folder cuối cùng

Theo Section 1.1. Cụ thể:

```
src/modules/stories/
├── api/
│   ├── stories.controller.ts
│   ├── stories.admin.controller.ts
│   └── dto/
│       ├── create-story.dto.ts
│       ├── update-story.dto.ts
│       ├── list-stories-query.dto.ts
│       ├── story-response.dto.ts
│       ├── story-detail-response.dto.ts
│       └── story-pricing-response.dto.ts
├── application/
│   ├── use-cases/                       # 10-12 use-case files
│   └── ports/
│       ├── story.repository.port.ts
│       ├── chapter.repository.port.ts   # re-export từ chapters module
│       ├── pricing-strategy.port.ts
│       └── ads-ledger.port.ts
├── domain/
│   ├── entities/story.entity.ts
│   ├── value-objects/
│   │   ├── story-slug.vo.ts
│   │   ├── price.vo.ts                  # shared kernel
│   │   └── story-status.vo.ts
│   └── errors/story.errors.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── story.prisma.repository.ts
│   │   └── story.prisma.mapper.ts
│   └── pricing/discount-rule.pricing.ts
├── stories.module.ts
└── __tests__/
    ├── unit/
    └── integration/
```

### 4.4 Quy trình refactor — strangler fig

1. Tạo cấu trúc mới rỗng (folder + module skeleton + ports + repository).
2. Migrate `GetStoryDetailUseCase` (read-only đơn giản) trước.
   - Tạo use-case → repository method → mapper → DTO response.
   - Trỏ controller endpoint cũ vào use-case mới.
   - Xoá method tương ứng khỏi `stories.service.ts`.
   - Chạy e2e + manual test → commit.
3. Migrate read-only flows còn lại (list public, list admin, search, pricing).
4. Migrate write flows đơn giản (create, update, status change).
5. Migrate flows phức tạp (unlock, unlock-by-ads — cần `UnitOfWork` cross-module).
6. `stories.service.ts` rỗng → xoá file → sửa imports → cập nhật module.
7. Verify cuối: e2e pass + manual qua FE.

### 4.5 Contract API mới — chuẩn hoá

- URL: `GET /stories`, `GET /stories/:id`, `POST /admin/stories`, `PATCH /admin/stories/:id`. Tách public vs admin namespace.
- Pagination: cursor-based cho list lớn (`?cursor=&limit=`), offset cho admin (`?page=&limit=`).
- Filter: `?status=published&authorId=&categoryId=&q=`.
- Response envelope theo Section 2.3.
- Field: camelCase, Date ISO 8601.

### 4.6 Test coverage gate

- Unit test cho `story.entity.ts`: tất cả rules thuần.
- Unit test ≥ 80% use-case với repository mock.
- Integration test cho repository (DB thật).
- E2e hiện tại không break.
- E2e mới cho stories: list, get detail, create, update, unlock.

### 4.7 Output: `docs/templates/module-refactor-template.md`

Cuối Phase 1, viết template tổng kết để propagation Phase 2 dùng:

- Cấu trúc folder copy từ Stories.
- Checklist propagation 15 bước.
- Pattern xử lý transaction cross-module.
- Pattern map domain ↔ Prisma.
- Pattern test use-case + repository.

### 4.8 Stop conditions

Dừng và review pattern nếu:

- 5 use-case mà lặp code > 30% → cần extract trước.
- Domain entity phải import Prisma type → tách chưa đủ.
- Repository có `findByFilterX_v2` → lạm dụng repo.
- Use-case > 150 LOC → cần tách sub-use-case.

---

## 5. Pattern propagation — 27 module còn lại (Phase 2)

### 5.1 Thứ tự ưu tiên (ROI-based)

| Đợt | Module | Lý do |
|---|---|---|
| **Wave 1** | `music` + `music-interaction` + `music-comment` | 3 god-service cùng context, refactor cùng nhau lợi nhất |
| | `user-features` | Cross-cut nhiều flow, refactor sớm để các module sau dùng port chuẩn |
| | `chapters` + `chapter-variants` | Phụ thuộc Stories đã có template |
| | `chapter-comments` | Pattern comment-thread dùng lại được |
| | `auth` | Nhạy cảm, để sau khi đã quen pattern |
| **Wave 2** | `reviews`, `mail`, `ads`, `tracking`, `transactions`, `memberships` | Mid-size |
| | `billing/*` (stripe, vietqr, webhook) | Có sub-folder rồi, tách port + use-case là chính |
| | `stats`, `banners`, `settings` | Mid-size |
| **Wave 3** | `categories`, `packages`, `upload`, `comments`, `notifications`, `personal-playlist`, `authors`, `languages`, `social-links` | Small, áp template |

### 5.2 Checklist propagation per module

```
[ ] 1. Đọc service hiện tại, liệt kê tất cả flow business
[ ] 2. Nhóm flow thành use-cases
[ ] 3. Vẽ relation với module khác → xác định ports cần
[ ] 4. Tạo cấu trúc folder layered
[ ] 5. Tạo domain entity + value objects + errors trước
[ ] 6. Viết unit test cho domain entity
[ ] 7. Tạo repository port + Prisma adapter + mapper
[ ] 8. Viết integration test cho repository (1 happy + 1 edge)
[ ] 9. Migrate từng use-case (read-only → write đơn giản → write phức tạp)
[ ] 10. Mỗi use-case có ≥ 1 unit test
[ ] 11. Tách controller cũ thành api/<feature>.controller.ts + admin nếu cần
[ ] 12. Chuẩn hoá DTO request + response + OpenAPI decorator
[ ] 13. Xoá service cũ khi hết reference
[ ] 14. Chạy e2e suite + lint + dependency-cruiser
[ ] 15. Commit theo từng flow, không commit khối lớn
```

### 5.3 Cross-module concerns — giải pháp chuẩn

**(a) Cross-module data access:** mỗi module export ports (interface read-only) qua `index.ts`. Module khác inject port, không import repository concrete.

**(b) Cross-module transaction:** `UnitOfWork` (shared kernel) bắt đầu Prisma `$transaction`, truyền `tx` xuống mọi repository trong use-case. Repository có signature `findById(id, tx?: PrismaTransaction)`.

**(c) Domain event:** event-on-commit pattern. Use-case append vào outbox trong cùng transaction. Sau commit, dispatcher (synchronous nội bộ, async qua BullMQ ở Phase 3) phát event. **Không** dùng EventEmitter bừa bãi (race với transaction).

**(d) Permission/RBAC:** guard ở tầng `api/` (controller `@Roles(...)`). Use-case nhận `CurrentUser` qua command DTO chỉ để check business rule. Không check authorization trong use-case.

**(e) Cache:** ở tầng infrastructure. `CachedStoryRepository` decorator wrap `StoryPrismaRepository`. Use-case không biết về cache. Key convention `<module>:<entity>:<id>`.

**(f) Background jobs:** cron handler ở `application/scheduled-tasks/` (chạy khi `APP_ROLE=scheduler`). Worker job ở `application/jobs/`. Cả hai gọi cùng use-case.

### 5.4 Coexistence rule

- Module đã refactor + module chưa refactor coexist ok.
- Module đang refactor dở phải commit ở trạng thái build pass + test pass.
- Không làm dở 3 module song song. Hoàn tất 15-step checklist 1 module rồi mới đụng module kế.

### 5.5 Pattern reuse rule

- Chỉ extract base class / utility khi đã thấy ≥ 3 lần lặp.
- Extract vào `shared/kernel/` (domain) hoặc `shared/persistence/` (repository helpers).
- KHÔNG extract vào `common/` (legacy folder sẽ giải tán).

### 5.6 Done criteria Phase 2

- 28/28 module follow layered structure.
- 0 file `*.service.ts` > 400 LOC.
- `dependency-cruiser` pass.
- ESLint architectural rules pass.
- E2e suite pass.
- `src/common/` giải tán, chuyển vào `src/shared/`.
- E2e mới cho ít nhất billing webhook, ads unlock, membership purchase.

---

## 6. Observability, scale, cleanup (Phase 3)

### 6.1 Metrics — Prometheus

- `prom-client` + custom interceptor → `/metrics` (internal port, không expose public).
- Metric chuẩn: `http_requests_total`, `http_request_duration_seconds`, `prisma_query_duration_seconds`, `cache_hit_total`, `cache_miss_total`, `scheduled_job_duration_seconds`, `domain_event_dispatched_total`.
- Không add metric custom trong business logic — chỉ infrastructure tier emit.

### 6.2 Distributed tracing — OpenTelemetry

- `@opentelemetry/sdk-node` + auto-instrumentation: HTTP, Prisma, Redis, Axios, Socket.io.
- Span thủ công ở use-case qua decorator `@Traced()`.
- Correlation-id liên kết trace-id ↔ log line ↔ request.
- Export OTLP → local Jaeger (dev) / vendor (prod).

### 6.3 Audit log

- Bảng `audit_log`: `id, actorId, action, resourceType, resourceId, before, after, requestId, ipAddress, userAgent, createdAt`.
- Decorator/interceptor `@Audited('story.update')`.
- Append-only. Retention configurable.
- Áp cho: admin CRUD trên Story/Chapter/Ad/Membership/Package, mọi billing event, role/permission change.

### 6.4 Storage — bỏ local uploads

- Mọi upload đi qua R2/UploadThing → URL trả về FE.
- Drop `app.use('/uploads', ...)` và folder `uploads/`.
- Image processing (resize, webp) → worker role qua BullMQ queue.

### 6.5 Rate limiting nâng cao

- Multi-tier: per IP, per authenticated user, per endpoint nhạy cảm.
- Redis-backed.
- Trả 429 chuẩn với `Retry-After`.

### 6.6 BullMQ queue

- Producer ở `api` role, consumer ở `worker` role.
- Bounded retry + DLQ.
- Queue: `mail-send`, `webhook-process`, `audio-process`, `image-process`, `domain-events`.
- Mỗi job có `job_duration` + `job_failure_total` metric.

### 6.7 Secret management

- Prod: secrets từ vault (Vault / SOPS / cloud secret manager).
- `.env.prod` không commit (chỉ giữ `.env.example`).
- `deploy.sh` lấy secret từ vault → sinh `.env` ngắn hạn → destroy sau start.
- Rotation policy cho JWT secret, DB password, R2 key.

### 6.8 CI/CD nâng cao

- Job e2e trong CI với MySQL + Redis service container.
- Security scan: `yarn npm audit`, optional Snyk / Dependabot.
- Build & push Docker image lên registry on merge to `main`.
- Deploy step (manual approval cho prod, auto cho staging).
- Migration safety check: `prisma migrate diff` cảnh báo destructive change → require label `approved-migration`.

### 6.9 Database hygiene

- Index review qua `EXPLAIN` cho query phổ biến.
- Soft-delete normalization (chọn pattern chung cho từng aggregate).
- Naming consistency.

### 6.10 Documentation & runbook

- `docs/architecture.md`: tổng quan layered, bounded context.
- `docs/runbook/incident-billing.md`, `runbook/incident-auth.md`, `runbook/incident-db.md`.
- `docs/onboarding.md`: setup local + first PR checklist.
- `docs/templates/module-refactor-template.md` (từ Phase 1).

### 6.11 Non-goals trong refactor scope

Không gộp vào, nếu cần thì mở project riêng:

- Microservices split.
- Đổi framework / ORM / DB.
- GraphQL.
- Multi-tenant / multi-region.
- Real-time analytics dashboard.
- SSR/SEO (đó là FE).
- AI/ML feature.
- Mobile native.

---

## 7. Testing strategy

### 7.1 Test pyramid

- **Unit (55-65%):** domain entity + use-case với mock ports. ~ms per test.
- **Integration (25-30%):** repository + DB thật, external adapters. ~giây per test.
- **E2E (10-15%):** golden path qua HTTP, DB thật. ~giây per test.

### 7.2 Phân loại test theo tầng

| Tầng | Loại | Mock gì | Mục tiêu |
|---|---|---|---|
| `domain/` | Unit (pure) | Không | Rules, invariants |
| `application/use-cases/` | Unit | Toàn bộ ports + UnitOfWork | Flow orchestration, error handling |
| `infrastructure/persistence/` | Integration | DB thật | Query, mapping, transaction |
| `infrastructure/external/` | Integration | SDK / sandbox | Webhook signature, idempotency, retry |
| `api/controllers` | E2E | DB thật, external mock | Routing, DTO validation, envelope, guard |

### 7.3 Vị trí test

```
src/modules/<feature>/__tests__/unit/         # domain + use-case
src/modules/<feature>/__tests__/integration/  # repository + DB
test/e2e/                                     # đã có sẵn, mở rộng
test/helpers/builders/                        # test data builders
test/helpers/db-test-container.ts             # testcontainers setup
test/helpers/matchers/                        # custom Jest matchers
```

### 7.4 Test data builders

Mỗi domain entity có 1 builder. Builder trả về **domain entity** cho unit test, **Prisma input** cho integration test (qua `.toPrismaCreate()`).

```ts
const story = aStory()
  .withTitle('Test')
  .published()
  .withPrice(50_000)
  .withChapters(3)
  .build();
```

### 7.5 Unit test cho use-case — pattern

```ts
describe('UnlockStoryByAdsUseCase', () => {
  let uc: UnlockStoryByAdsUseCase;
  let stories: jest.Mocked<StoryRepositoryPort>;

  beforeEach(() => {
    stories = createMock<StoryRepositoryPort>();
    uc = new UnlockStoryByAdsUseCase(stories, ...);
  });

  it('returns StoryNotFound when story missing', async () => { ... });
  it('returns AdsQuotaExhausted when user reached daily limit', async () => { ... });
  it('records ledger entry and marks unlocked on success', async () => { ... });
});
```

Mỗi use-case có ≥ 1 happy + 2-3 error cases.

### 7.6 Integration test cho repository

- MySQL testcontainer (ephemeral, isolated, reproducible).
- `beforeAll`: migrate + seed minimal.
- `beforeEach`: truncate tables, không drop schema.
- Test chạm DB thật, không mock Prisma.

### 7.7 E2E expansion

Mở rộng e2e hiện có:

- Stories: list (cursor), detail, create admin, update admin, unlock (ads + pulse), pricing.
- Billing: Stripe webhook (sign ok/fail, idempotent), VietQR webhook, refund.
- Membership purchase: full flow package → transaction → webhook → active.
- Notifications: socket connect, event, disconnect.
- Rate limit: per-IP + per-user + per-endpoint.

External: sandbox hoặc fake server (`stripe-mock`, `localstack` cho S3-compat).

### 7.8 Coverage gate trong CI

| Layer | Threshold |
|---|---|
| `domain/` | ≥ 90% |
| `application/use-cases/` | ≥ 80% |
| `infrastructure/persistence/` | ≥ 70% |
| `api/controllers/` | ≥ 60% |
| Overall | ≥ 70% |

CI fail nếu không đạt.

### 7.9 Anti-patterns cần tránh

- Test Prisma trực tiếp ở unit test.
- Mock Prisma client trong unit test → signal chưa tách port đúng.
- Snapshot test cho response body lớn.
- 1 e2e test cover quá nhiều bước.
- Test phụ thuộc thứ tự (mỗi test phải độc lập).

### 7.10 Test runtime budget

- Unit toàn bộ: < 30s.
- Integration toàn bộ: < 3 phút.
- E2e toàn bộ: < 5 phút.

CI có thể chia matrix theo wave nếu vượt.

---

## 8. Risks, gates, timeline & success criteria

### 8.1 Risks chính

| Risk | Mitigation |
|---|---|
| Refactor kéo dài → bỏ dở | Approach B paused được. Mỗi commit build+test pass. Không dở 3 module song song. |
| Pattern Phase 1 sai → 27 module sai theo | Stop conditions (4.8). Review pattern sau Phase 1. Refactor module 2-3 cẩn thận, lệch thì sửa template. |
| God-service → god-use-case | Use-case > 150 LOC = signal tách. Entity gánh rules. |
| Anemic domain | Self-check: rule có thuần không? Có cần Prisma không? Thuần → đẩy entity. |
| Cross-module transaction phức tạp | 1 use-case = 1 transaction boundary. Không nested. |
| FE-BE drift | OpenAPI là contract. Phase 0a sinh `openapi.json` artifact. |
| Schema split sai | Gate Section 3.4. Rollback rõ ràng. |
| Test integration chậm → skip → drift | Testcontainers share connection. `yarn test:unit` cho dev nhanh. E2e+integration chỉ trước push. |
| Regression security ở billing/auth | Wave 1 cuối, Wave 2 đầu. E2e auth/rbac/billing webhook làm gate. Manual test thêm. |
| Phase 3 bị skip | Gate cứng. Không tuyên bố done nếu Phase 3 chưa làm. |
| Doc bỏ qua | PR có yêu cầu update doc đi kèm. |

### 8.2 Gates (không skip)

| Gate | Pass criteria |
|---|---|
| **G0a** | Boot fail nếu env thiếu. `/healthz` 200. Swagger UI accessible. Error envelope chuẩn. CI lint+typecheck pass. Docker build. |
| **G0b** | `prisma migrate diff` empty. E2e pass. Legacy aliases xoá. |
| **G1** | Stories module layered. `stories.service.ts` cũ xoá. Coverage use-case ≥ 80%, domain ≥ 90%. E2e pass. `module-refactor-template.md` viết xong. |
| **G2-W1, W2, W3** | Module trong wave follow template. 0 service > 400 LOC. E2e pass. dependency-cruiser pass. |
| **G3** | `/metrics` hoạt động. Tracing emit. Audit log ghi admin action. Uploads 100% R2. BullMQ ≥ 1 consumer. Runbook viết. Coverage gate (7.8) đạt. |

### 8.3 Timeline estimate (1 dev full-time)

| Phase | Estimate |
|---|---|
| Phase 0a — Foundation | 1.5-2 tuần |
| Phase 0b — Schema split + ENV cleanup | 2-3 ngày |
| Phase 1 — Reference module Stories | 2-3 tuần |
| Phase 2 — Wave 1 (music, user-features, chapters, chapter-comments, auth) | 5-7 tuần |
| Phase 2 — Wave 2 (mid-size) | 3-4 tuần |
| Phase 2 — Wave 3 (small) | 2-3 tuần |
| Phase 3 — Observability + cleanup | 3-4 tuần |
| Buffer | 1-2 tuần |
| **Tổng** | **~4-5 tháng full-time** |

### 8.4 Success criteria — refactor coi như xong khi

1. Toàn bộ 28 module layered structure. 0 file `*.service.ts` > 400 LOC. `src/common/` giải tán.
2. `prisma/schema/` multi-file 9 bounded context.
3. Coverage đạt gate Section 7.8. E2e mở rộng theo 7.7. Domain ≥ 90%.
4. Observability: `/metrics` + OTLP tracing + audit log + structured logging với correlation-id.
5. Operability: Docker build. CI full pipeline pass. Graceful shutdown verify. Health/readiness. Secret từ vault.
6. Contract: `openapi.json` artifact ở build. FE codegen từ đây.
7. Storage: uploads 100% R2/UploadThing. Folder `uploads/` xoá.
8. Queue: BullMQ ≥ 3 queue (mail, webhook, audio).
9. Documentation: `architecture.md` + `runbook/` + `onboarding.md` + `templates/`.
10. No regression: feature hiện tại còn hoạt động (e2e + manual checklist).

### 8.5 Maintenance routine sau refactor

- PR review: file > 300 LOC → reviewer hỏi tách. `*.service.ts` > 400 LOC → block merge.
- Feature mới: bắt đầu bằng domain entity / value object.
- Schema change: bắt buộc migration + diff check CI.
- Quarterly review: đọc lại `module-refactor-template.md` + `architecture.md`, cập nhật nếu pattern evolve.

---

## 9. Next steps

Sau khi spec này được approve:

1. Invoke **writing-plans** skill để tạo implementation plan chi tiết cho Phase 0a.
2. Mỗi phase tiếp theo sẽ có plan riêng khi tới gate. Không viết plan dài 4 tháng một lượt — quá nhiều giả định, sẽ lệch thực tế.
3. Plan Phase 0a sẽ là step-by-step actionable, với commit boundary rõ ràng, test gate cho mỗi step.

---

## 10. Open decisions (chốt trong plan, không chốt trong spec)

Các điểm sẽ quyết khi viết plan chi tiết, không phải khi viết spec:

- Naming convention cuối cùng cho use-case file (`create-story.use-case.ts` vs `create-story.usecase.ts` vs `CreateStory.usecase.ts`).
- Có dùng `nest-cli` schematics tự sinh boilerplate không, hay tự viết.
- Pattern cụ thể cho `Result<T, E>` (tự code vs neverthrow lib).
- Test container vs MySQL test DB riêng (Section 7 đề xuất testcontainers, nhưng nếu test runtime quá chậm có thể fallback).
- Tên cụ thể của metric label, span name (sẽ chuẩn hoá ở Phase 3).
