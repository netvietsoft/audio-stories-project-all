================================================================================
 FILE NGỮ CẢNH CHO AI  —  ĐỌC ĐẦU TIÊN MỖI PHIÊN
 Dự án: audio-stories-project-all  (monorepo BE + FE)
 Vị trí: D:\SetupC\Projects\NovelApp\backend  (be/ , fe/ , docs/)
 Cập nhật: 2026-06
================================================================================

QUY ƯỚC NHANH (đọc 30 giây):
  - Đây là file ngữ cảnh tổng ("bản đồ"). Chi tiết nằm trong docs/.
  - Trước khi sửa code ở vùng nào, MỞ doc vùng đó trong docs/ (xem MỤC LỤC ở
    phần 3) rồi mới đụng code.
  - Khi tài liệu mâu thuẫn với code thật → TIN CODE. Tài liệu có thể trễ.
  - BE KHÔNG có global prefix /api. Route trong code = route thật (vd /stories,
    /music, /auth/login). Đừng tự thêm /api.


## 1  DỰ ÁN LÀ GÌ
--------------------------------------------------------------------------------
Monorepo "audio-stories-project-all": app đọc truyện + nghe audiobook/nhạc, có
hệ thống coin ảo "Pulse", VIP/membership, mở khoá chương (Pulse / quảng cáo /
mua nguyên truyện), bình luận, đánh giá, CSKH, và trang admin.

  - Repo:  github.com/netvietsoft/audio-stories-project-all  (branch main)
  - Local: D:\SetupC\Projects\NovelApp\backend
      be/    — Backend NestJS 11 + Prisma 6 / MySQL + Redis (cổng 3000)
      fe/    — Frontend Next.js 16 + React 19 + Tailwind 4 (Moonrepo + Yarn 4)
                 apps/web   cổng 3001   (app người dùng, định tuyến theo [lang])
                 apps/admin cổng 3002   (trang quản trị)
                 packages/  api-client, shared, ui (shared dùng thật; api-client
                            & ui hiện là STUB)
      docs/  — Tài liệu kiến trúc + module (file này trỏ tới)

Dữ liệu mẫu (đã import dump netviet_audio vào DB audio_stories_dev):
  180 stories, 2560 chapters, 9 users, 24 music; 39 prisma migrations.


## 2  CHẠY LOCAL  (đã setup xong — làm theo đúng các lưu ý)
--------------------------------------------------------------------------------
HẠ TẦNG (bắt buộc cho BE):
  - MySQL qua Laragon (Laragon đã chuyển sang D:\SetupC\laragon).
      root KHÔNG mật khẩu, DB = "audio_stories_dev".
  - Redis portable ở D:\SetupC\Tools\Redis (cổng 6379) — BẮT BUỘC. Thiếu Redis
    thì BE fail (cache + throttler + health + tracking 503).
  - Node 24.12 (engines yêu cầu 24.16), Yarn 4.15 qua corepack
    (corepack ở E:\Programming\corepack.cmd).

CẠM BẪY MÔI TRƯỜNG ĐÃ XỬ LÝ:
  - Ổ C TỪNG ĐẦY → đã trỏ COREPACK_HOME / TMP / TEMP / yarn cache sang
    D:\SetupC\Tools\ (đặt biến ở User scope). Khi chạy BE nên set TMP về D:.
  - Upload audio bắt buộc cấu hình Cloudflare R2; local để trống → bootstrap
    fail. ĐÃ điền giá trị GIẢ trong be/.env để boot được (không upload thật).

LỆNH CHẠY (đã kiểm chứng):
  Backend:
    cd D:\SetupC\Projects\NovelApp\backend\be
    (set TMP về D:)
    corepack yarn start:dev:nest

    *** ĐỪNG dùng "yarn api:dev" *** — script dev-role.cjs spawn 'yarn.cmd'
    KHÔNG đặt shell:true → Node 24 báo EINVAL (vá CVE liên quan .cmd).
    Chạy thẳng start:dev:nest. Migrate deploy đã làm thủ công (no-op).

  Web:
    cd D:\SetupC\Projects\NovelApp\backend\fe\apps\web
    corepack yarn dev

ĐỊA CHỈ:
  - BE:    http://localhost:3000      Swagger: http://localhost:3000/docs
           (KHÔNG global prefix /api — route là /stories, /music, /auth/...)
  - WEB:   http://localhost:3001      vào /vi hoặc /en. "/" trả 404 là ĐÚNG
           (định tuyến theo segment [lang]).
  - ADMIN: http://localhost:3002
  - FE gọi BE qua NEXT_PUBLIC_API_URL = http://localhost:3000


## 3  MỤC LỤC TÀI LIỆU  (docs/)
--------------------------------------------------------------------------------
  01-kien-truc.md                  Kiến trúc & bootstrap BE: 3 vai (api/worker/
                                   scheduler) qua APP_ROLE, ApiResponse wrap
                                   {data,meta}, config Zod, throttler, health.
  02-be-auth-users.md              Auth (JWT access+refresh, argon2, Google
                                   OAuth) + Users + RBAC (1 user 1 role, perms
                                   JSON). Nhiều vấn đề bảo mật.
  02-be-stories-chapters.md        Stories, chapters, chapter-variants (truyện
                                   tương tác), categories, authors, languages;
                                   3 đường mở khoá; proxy audio 302.
  02-be-music.md                   Music (single/podcast/playlist) + personal-
                                   playlist + reviews (cho Story) + comments +
                                   chapter-comments.
  02-be-other-modules.md           notifications, tracking (Redis buffer + cron),
                                   ads, banners, settings, stats, user-features
                                   (god-service), social-links.
  04-database.md                   Prisma schema (~40 model, ~20 enum) 1 file
                                   ~1173 dòng; enum là nguồn sự thật về status;
                                   đổi tên Credit->Pulse còn dở.
  05-integrations-webhooks.md      Billing: Stripe + VietQR/Casso webhook,
                                   packages (JSON trong site_settings),
                                   membership, transactions, upload R2/
                                   UploadThing, mail/SMTP, env.
  03-frontend-web.md               apps/web: App Router [lang], Axios apiClient
                                   + BFF, auth (access localStorage + refresh
                                   HttpOnly), cạm bẫy double-unwrap {data}.
  03-frontend-admin-packages.md    apps/admin + packages shared/ui/api-client;
                                   3 hệ auth song song; di sản web còn sót.
  07-quy-tac-code.md               Quy tắc bắt buộc + 20 cạm bẫy + 16 lỗi cấu
                                   trúc xếp ưu tiên + checklist commit.
  08-api-list.md                   DANH SÁCH ~180 endpoint BE (nhóm theo module,
                                   luồng công khai, ghi chú phân quyền).
  09-audio-pipeline.md             LUỒNG AUDIO: upload->R2->lưu DB->serve 302->FE phát;
                                   preload (metadata, chưa preload next); HLS/m3u8 CHƯA có;
                                   điểm cắm server Python ngoài (InternalApiKeyGuard + r2AudioUrl);
                                   cấu hình R2/Cloudflare; bản đồ file.
  README.md                        Index bảng ngắn của docs/.

  docs/superpowers/specs/*-be-refactor-design.md  — thiết kế refactor BE.
  docs/superpowers/plans/*.md                     — kế hoạch tách FE/refactor.

  (Ngoài ra mỗi module BE/FE có README.md riêng trong thư mục src của nó —
   xem cuối từng doc vùng để biết danh sách.)


## 4  NHỮNG ĐIỀU PHẢI NHỚ  (tổng hợp — đánh số)
--------------------------------------------------------------------------------
 1. KHÔNG global prefix /api. @Controller('stories') = /stories. Health
    /healthz (liveness) + /readyz (DB+Redis). Stripe webhook
    /billing/webhook/stripe. Swagger /docs chỉ non-production.

 2. MỘT entrypoint dist/main.js chạy 3 vai qua APP_ROLE
    (be/src/common/app-role.util.ts). Chỉ vai 'api' mở HTTP server; 'worker'
    và 'scheduler' chỉ tạo application context; chỉ 'scheduler' bật
    ScheduleModule (cron). Production PM2: auth-be (api, port 8035) +
    auth-be-worker + auth-be-scheduler.

 3. BE BỌC MỌI response thành { data, meta:{requestId} } (ApiResponseInterceptor)
    và lỗi thành { error:{code,message,details?}, meta }. => FE phải unwrap.
    Qua Axios apiClient: lấy res.data.data (axios bọc .data + BE bọc {data}).
    Qua fetch/BFF: chỉ .data 1 lần. BE đôi khi trả MẢNG TRẦN → luôn phòng thủ
    (Array.isArray(x) ? x : x?.data) ?? []. Đây là nguồn bug cũ ở
    HomePageClient.tsx (".map is not a function") — ĐÃ FIX.
     >>> CHUẨN: dùng helper fe/apps/web/src/lib/api/unwrap.ts — unwrapList(x) lấy MẢNG,
         unwrapData(x) lấy OBJECT, an toàn bất kể bọc 0/1/2 lớp. Đã quét & áp toàn FE
         (78 chỗ). MỌI chỗ lấy data từ API NÊN bọc qua 2 helper này.

 4. Tiền ảo = "Pulse" (User.pulseBalance). Mỗi lần cộng/trừ ghi 1 dòng
    CreditTransaction (sổ cái có before/after). LƯU Ý: đổi tên Credit->Pulse
    còn DỞ — cột DB vẫn tên cũ: pulseBalance@map(credits),
    pulseAmount@map(amount), pulseSpent@map(credits_spent),
    pulseAdded@map(credits_added).

 5. Redis BẮT BUỘC (cache + throttler + health + tracking). R2 bắt buộc cho
    upload audio (local điền giá trị giả). Bucket R2 có dấu '_' bị từ chối.

 6. ĐỪNG chạy "yarn api:dev" trên Windows/Node24 (EINVAL do spawn yarn.cmd
    thiếu shell:true). Chạy "corepack yarn start:dev:nest".

 7. Enum trong schema.prisma là NGUỒN SỰ THẬT về status. CHÚ Ý:
    PaymentStatus có CẢ SUCCESS lẫn SUCCEEDED (trùng nghĩa) — lọc "đã thanh
    toán" phải check cả hai. ChapterAccessType (free/timed/vip/ads, chữ thường)
    KHÁC ChapterUnlockType (VIP/TIMED/PULSE/AD, chữ HOA) — không map 1-1.

 8. 3 cơ chế mở khoá nội dung truyện: UserStoryUnlock (cả truyện),
    UserChapterUnlock (từng chương, có unlockType), UserUnlockedVariant
    (nhánh tương tác). Audio LUÔN qua proxy GET /chapters/:id/audio (302
    redirect sau entitlement check) — audioUrl không bao giờ lộ trong JSON public.

 9. RBAC: 1 user = 1 Role; Role.permissions là cột JSON mảng string.
    Permission bị ĐÓNG BĂNG trong access token: đổi Role.permissions không hiệu
    lực tới khi user login/refresh lại. RolesGuard so role không phân biệt
    hoa/thường; social-links lại dùng @Roles('admin') chữ thường (lệch chuẩn).

10. Schema Prisma là 1 FILE ~1173 dòng (be/prisma/schema.prisma). God-services
    thật: chapters ~32KB, stories ~31KB, music ~31KB, user-features ~29KB.
    Controller chỉ pass-through, service ôm business + query + mapping.

11. BUG slugify: be/src/common/utils/slug.util.ts:14 regex /[^a-z0-0\s-]/g
    (typo "0-0") xoá mọi chữ số 1-9 khỏi slug; ĐÚNG phải là /[^a-z0-9\s-]/g.

12. i18n FE: mọi route dưới app/[lang]/** (vi|en, mặc định vi). Middleware
    redirect / -> /{locale} và guard prefix /profile,/dashboard,/library,/player
    dựa cookie access_token (Max-Age 1h, không refresh tại middleware).

13. Vai 'worker' GẦN NHƯ RỖNG — app.module.ts chưa import BullModule, chưa có
    queue/consumer. Job nền đang THIẾU.

14. Hai hệ config song song: AppConfigService (Zod, fail-fast) vs @nestjs/config
    ConfigModule (TODO migrate ở app.module.ts) + đọc process.env rải rác.
    Legacy ENV alias (MAIL_FROM, VIETQR_DEFAULT_TEMPLATE, VIETQR_ACQ_ID,
    R2_SECRET_KEY_ID) bị THROW khi boot.

15. Throttler in-memory (không cấu hình Redis storage) → trong PM2 cluster mỗi
    process đếm riêng. SerializeBigintInterceptor là NO-OP (code chết);
    BigInt serialize thật do patch BigInt.prototype.toJSON ở bootstrap.ts.


## 5  TÌNH TRẠNG & PHẦN CÒN THIẾU
--------------------------------------------------------------------------------
TÌNH TRẠNG: Toàn bộ 10 vùng khảo sát = "done". App chạy local OK (BE 3000,
WEB 3001, ADMIN 3002). Đã viết doc tổng + README từng module.

PHẦN CÒN THIẾU (gộp theo vùng):
  Backend lõi:
    - Hệ thống queue/worker (BullMQ) cho vai worker — chưa wire.
    - Hoàn tất migrate khỏi @nestjs/config sang AppConfigService.
    - Throttler dùng Redis storage để chia sẻ khi scale ngang.
    - Điền meta.pagination ở tầng interceptor / chuẩn hoá phân trang.
    - Ràng buộc env theo STORAGE_PROVIDER (s3 phải có AWS_*, v.v.).
  Auth:
    - Không có endpoint đổi mật khẩu khi đã đăng nhập (chỉ forgot/reset).
    - Không có API CRUD role/gán permission (chỉ sửa DB/seed).
    - Không có cơ chế khoá tài khoản (isActive không được kiểm khi login).
    - Không rate-limit riêng cho login/forgot (dễ brute-force mã 6 số).
    - Không có refresh-token-reuse detection thực sự.
    - InternalApiKeyGuard & PermissionsGuard viết rồi nhưng chưa dùng.
  Stories/Chapters:
    - Chưa rõ nơi tăng totalViews/viewCount (xác minh ở tracking/user-features).
    - averageRating/ratingCount chỉ đọc (cập nhật ở reviews module).
    - Không validate chặn xoá Language/Author/Category đang được tham chiếu.
    - Không DTO/Swagger cho response; không test cho luồng unlock.
    - discountPercent chưa thống nhất (unlockVariant bỏ sót).
  Music & social:
    - Chia sẻ playlist cá nhân công khai (isPublic có nhưng không route).
    - Xoá review + đồng bộ rating khi xoá (không có endpoint delete).
    - Soft-delete/audit cho comment (hiện xoá cứng).
    - Giới hạn độ dài + chống spam music-comment; report cho music-comment.
  Billing/Integrations:
    - Cron huỷ đơn VietQR/PENDING quá hạn (+ dùng VIETQR_ORDER_EXPIRY_MINUTES).
    - Luồng user MUA Membership (không có membership.create) + set VIP tier/expiry.
    - EMV QR string cho VietQR (qr_emv hiện null).
    - Bảng riêng cho packages thay vì JSON trong site_settings.
    - Chống replay + timing-safe compare cho webhook Casso.
  Module phụ trợ:
    - notifications không realtime (Socket.io/SSE/push); không broadcast admin.
    - tracking không tách số lượt nghe; không lock cron phân tán.
    - stats thiếu thống kê theo thời gian/tác giả/churn; không phân trang DB.
  Frontend web:
    - Trang /login, /register dạng page (auth chỉ qua modal — cần kiểm chứng 404).
    - SSR/ISR cho trang chủ (HomePageClient initialData rỗng → first paint trống).
    - Cache thật cho public-story-cache; gọi BE /auth/logout khi logout.
    - Giữ pathname+query khi đổi ngôn ngữ.
  Frontend admin/packages:
    - packages/api-client thiếu axios instance + interceptor + unwrap chung.
    - packages/ui thiếu component dùng chung (đang nằm trong apps/admin).
    - Gỡ di sản web khỏi admin (auth/, store/authStore.ts, user-store.ts...).
  Database:
    - Không có bảng giao dịch gift dù Story.totalGifts có counter.
    - Không có audit log chung cho hành động admin.
    - Không thấy bảng/cột lưu push token (dù có allowBellNoti).


## 6  LỖI CẤU TRÚC / LOGIC CẦN REFACTOR  (ưu tiên cao -> thấp)
--------------------------------------------------------------------------------
[ƯU TIÊN CAO — bảo mật / đúng tiền / crash]
  >>> CẬP NHẬT 2026-06: ĐÃ FIX H1,H2,H3,H4,H5,H6,H8,H9 (xem dấu [✓] bên dưới).
      H7 = KHÔNG có cột isActive/status trong schema (đã gỡ) → là tính năng còn
      THIẾU (cần thêm cột), không phải bug sửa được ngay. H10: không tìm thấy
      hàm deletePayment trong billing → CHƯA xác minh, để lại rà sau.
  H1. [✓ FIX] DOUBLE-CREDIT Stripe: webhook VÀ verify-payment đều cộng Pulse; idempotency
      yếu (findFirst, providerPaymentId khác nhau giữa 2 đường) → có thể trùng
      tiền. Nên create + bắt P2002 trên @@unique([provider,providerPaymentId]).
  H2. [✓ FIX] Payment.create KHÔNG set field provider → DB mặc định VIETQR cho cả Stripe
      → thống kê theo provider sai.
  H3. [✓ FIX] JWT secret fallback '' khi thiếu env → giả mạo token. Phải throw lúc boot.
  H4. [✓ FIX] /auth/check-premium KHÔNG có guard, nhận user_id tuỳ ý → rò rỉ trạng thái
      premium bất kỳ ai.
  H5. [✓ FIX] Google OAuth liên kết tài khoản qua email mà KHÔNG kiểm email_verified của
      Google → rủi ro account takeover.
  H6. [✓ FIX một phần: timing-safe + bỏ log hash; CÒN thiếu chống-replay timestamp] Webhook Casso verify yếu: so sánh === (không timingSafeEqual), không kiểm
      timestamp (replay), log cả expected/computed hash, trả 200 cả khi sai sig.
  H7. login KHÔNG kiểm isActive (status hardcode 'ACTIVE') → không thể khoá tài khoản.
  H8. [✓ FIX] BUG slugify regex "0-0" xoá chữ số (slug.util.ts:14).
  H9. [✓ FIX mã sinh bằng crypto.randomInt; verify O(n) vẫn còn] Mã verify/reset 6 số dùng Math.random() (không crypto-secure); verify quét
      findMany O(n) toàn bảng.
  H10. deletePayment xoá CreditTransaction sai referenceId (Stripe lưu
       payment_intent||session.id ≠ payment.id) → để lại bản ghi mồ côi; không
       hoàn Pulse.

[ƯU TIÊN TRUNG — kiến trúc / nhất quán / hiệu năng]
  M1. God-services ôm business+query+mapping (chapters/stories/music/user-
      features). Tách theo trách nhiệm (Unlock/Gift/Favorites/Subscription/...).
  M2. Schema Prisma 1 file ~1173 dòng → tách multi-file theo domain.
  M3. Hai cơ chế map lỗi Prisma không đồng bộ (GlobalExceptionFilter vs
      error-handler.util.ts handlePrismaError) → gộp về một.
  M4. Permission đóng băng trong JWT + 2 guard (Roles load DB / Permissions đọc
      claim cũ) lệch nguồn dữ liệu.
  M5. rotateRefresh không atomic (delete rồi issue ngoài transaction).
  M6. Hai hệ config song song + đọc process.env rải rác (xem mục 4.14).
  M7. Throttler in-memory không chia sẻ giữa process/cluster → dùng Redis storage.
  M8. Hai kết nối Redis song song (RedisHealthIndicator vs cache-manager redisStore).
  M9. Cache categories sai: @CacheKey('categories:all') không gồm query
      (language/search/page) → trả nhầm data.
  M10. discountPercent bất nhất (unlockVariant bỏ sót).
  M11. Hard delete (categories/authors/languages) vs soft delete (stories/
       chapters/variants) → mô hình xoá không nhất quán, rủi ro vỡ FK.
  M12. Bộ đếm denormalized (like/comment/play count...) cập nhật thủ công nhiều
       nơi, đọc-rồi-ghi không transaction → race + lệch số.
  M13. Playlist nhạc tồn tại nhiều dạng song song (Music.playlistTrackIds JSON
       vs MusicPlaylist/MusicPlaylistTrack) → nguồn dữ liệu kép; query O(n).
  M14. Phân trang trong RAM (user-features.getHistory, stats.getVipChapterStats,
       transactions take:200, music tag filter) → không scale.
  M15. XUNG ĐỘT ROUTE tiềm tàng namespace comments/* (comments admin vs
       chapter-comments) và 2 controller cùng prefix 'music'.
  M16. FE: trùng cây route cũ (main)/<x> vs mới (main)/story/<x>; 2 store auth
       + 2 thư mục store/stores; double-unwrap không nhất quán.
  M17. FE admin: 3 hệ auth song song; upload-media.ts dùng apiClient (web) thay
       vì adminApiClient; component/page khổng lồ (Navbar 66KB, stories 77KB...).

[ƯU TIÊN THẤP — dọn dẹp / code chết]
  L1. SerializeBigintInterceptor no-op (xoá).
  L2. ensureDefaultUserRoleId trùng lặp (auth.service + oauth.service); GeoIP
      backfill lặp 4 chỗ; helper userIdFromAccount lặp mọi controller.
  L3. meta.pagination khai trong type nhưng interceptor không bao giờ điền.
  L4. /auth/me trả _debug (jwtPayload) ra response.
  L5. Cookie access_token đọc nhưng không nơi nào set (dead-path).
  L6. THIẾU cron huỷ đơn VietQR quá hạn; env VIETQR_* / CASSO_* / AWS_* khai
      báo nhưng chưa dùng.
  L7. public-story-cache (FE) không cache thật (BFF no-store) — tên gây hiểu nhầm.
  L8. social-links @Roles('admin') chữ thường lệch chuẩn; import Prisma path
      tương đối; GET /:id public không lọc isActive.
  L9. seed-music.ts không deleteMany trước khi tạo → chạy lại chồng dữ liệu.
  L10. PaymentStatus thừa SUCCESS + SUCCEEDED; Advertisement.routeType magic
       number; User.roleId default=4 nhưng seed chỉ tạo role 1,2.


## 7  QUY TRÌNH LÀM VIỆC CHO AI
--------------------------------------------------------------------------------
 1. TRƯỚC KHI SỬA: mở doc vùng tương ứng trong docs/ (mục 3) + README.md của
    module đó. Hiểu luồng business trước, đừng sửa mù.

 2. ĐỐI CHIẾU ENUM/MODEL: mọi thứ liên quan status/access/unlock/payment phải
    đối chiếu be/prisma/schema.prisma (enum là nguồn sự thật). Nhớ cột DB còn
    tên cũ "credits/amount/credits_spent/credits_added" (mục 4.4) và
    PaymentStatus SUCCESS vs SUCCEEDED (mục 4.7).

 3. ROUTE: không tự thêm /api. Kiểm tra @Controller để biết route thật. FE
    nhớ quy tắc unwrap {data} (mục 4.3).

 4. KHI MÂU THUẪN: TIN CODE hơn tài liệu. Nếu phát hiện doc sai → sửa code
    trước, rồi cập nhật doc.

 5. SAU KHI SỬA: cập nhật doc vùng + README module liên quan (theo memory:
    "sau mỗi fix phải cập nhật CHANGELOG + module README"). Nếu fix nằm trong
    danh sách mục 6, ghi chú đã xử lý.

 6. CHẠY/KIỂM: dùng lệnh ở mục 2 (start:dev:nest cho BE, KHÔNG api:dev). Đảm
    bảo Redis đang chạy. Test luồng qua Swagger /docs hoặc FE /vi.

 7. KHÔNG tạo file report/summary .md rác. Ghi phát hiện vào doc vùng có sẵn.

================================================================================
## 8  NHẬT KÝ PHIÊN & TRẠNG THÁI HIỆN TẠI  (cập nhật 2026-06-29)
================================================================================

--- 0. (2026-06-29) ĐÃ MERGE HLS CỦA TEAM (git strategy A) ---
  * main giờ = origin/main (bcf2659, "update audio-deploy FE") + commit fix của mình (5e2ed7d).
  * Nhánh backup an toàn: session-fixes (dba1dc6) — chứa toàn bộ work cũ + HLS stub cũ + dump sql.
  * HLS dùng CỦA TEAM: be/src/hls/ (BullMQ queue "hls-bull" + AES-128 + HlsAsset table riêng,
    enum HlsAssetType{chapter,variant,music}/HlsStatus{pending,processing,ready,failed}).
    HLS stub cũ của mình (be/src/audio-pipeline + cột audio_status trên music_tracks) ĐÃ BỎ.
  * API /music trả thêm field `hlsUrl` (decorateWithHls đọc HlsAsset status=ready); rỗng cho tới
    khi worker VPS transcode xong. FE GlobalPlayer dùng hls.js khi có hlsUrl (đã sửa, không đòi audioStatus).
  * ENV MỚI BẮT BUỘC trong be/.env (fail-closed, thiếu là BE không boot):
      HLS_MASTER_KEY=<64 hex>  PUBLIC_API_URL=http://localhost:3000  HLS_AUDIO_BITRATE=128k  HLS_SEGMENT_SECONDS=10
  * Đã chạy: corepack yarn install (be, +bullmq) ; prisma db push --accept-data-loss ; prisma generate ;
    corepack yarn workspace @audio-stories/web add hls.js (hls.js@1.6.16).
  * VERIFY: BE boot OK (:3000), web :3001, admin :3002 đều chạy; /music trả hlsUrl field.
  * .gitignore đã harden: chặn .env/.env.*/env//node_modules//*.sql (secret KHÔNG bị track).

--- 0b. (2026-06-29) HLS CHẠY THẬT END-TO-END (giữ TS của team, KHÔNG Python) ---
  * Xác nhận "HLS VPS/*.tar.gz" chỉ là bản sao repo, KHÔNG có Python convert. HLS = TS ở be/src/hls/.
  * Chốt phương án: giữ hls-transcode.service.ts (ffmpeg qua Node). Python KHÔNG lợi gì vì transcode
    do ffmpeg làm; viết lại Python = 2 runtime + vứt code đang chạy. Cần tách CPU -> chạy vai worker
    trên VPS riêng (cùng Redis/DB/R2), KHÔNG cần Python.
  * SỬA CODE: ffmpeg/ffprobe path cấu hình được — thêm FFMPEG_PATH/FFPROBE_PATH (app-config.schema.ts
    default 'ffmpeg'/'ffprobe'; hls-transcode.service.ts dùng cfg thay vì hardcode). be/.env trỏ bản
    portable D:\SetupC\Tools\ffmpeg\bin (copy từ TTSHUB build 2024-12, có cả ffprobe).
  * THEO YÊU CẦU: HLS_SEGMENT_SECONDS=3 (segment 3s); FE GlobalPlayer hls.js maxBufferLength=30
    (preload ~30s — mặc định hls.js; trên bài dài 10s preload nhìn như "không preload"). Giữ MP3
    gốc (fallback + re-transcode), KHÔNG xoá.
  * UI: thêm thanh "đã tải/buffered" trên progress bar (GlobalPlayer.tsx) — đọc audio.buffered (sự
    kiện progress/timeupdate), state bufferedPercent, render lớp accent mờ 0.35 sau lớp đã-nghe trên
    cả slider (gradient 3 lớp) lẫn thanh mảnh mobile.
  * Script mới: be/scripts/hls/enqueue.ts (boot Nest standalone -> registerAsset cho asset có sẵn).
  * VERIFY: worker (APP_ROLE=worker, dist) consume job -> 103 segment 3s, 307s; m3u8 EXT-X-KEY AES-128
    trỏ /hls/music/<id>/key; upload audio/hls/music/<id>/<runId>/; HlsAsset=ready; GET /music/1 trả
    hlsUrl; GET key 200 (16 byte, free, ẩn danh); seg_000.ts trên R2 200 video/mp2t. tsc BE exit 0.

--- 0c. (2026-06-29) SWAGGER + ADMIN UI + UPLOAD LIMIT ---
  * SWAGGER: thêm @ApiTags + @ApiOperation(summary tiếng Việt) cho TOÀN BỘ 201 endpoint / 33 controller
    (32 nhóm). /docs giờ nhóm theo module + mô tả từng API. Route admin có hậu tố "(admin)". tsc exit 0.
    (Làm bằng 6 subagent song song; coverage 201/201 đã verify qua /docs-json.)
  * UPLOAD LIMIT: nâng 120MB->500MB ở music.controller.ts (MUSIC_INTERCEPTOR, memoryStorage -> giữ file
    trong RAM) và 100MB->500MB ở upload.controller.ts (/upload/audio). Lỗi "File too large" = multer
    LIMIT_FILE_SIZE. PROD: nhớ nới nginx client_max_body_size; file rất lớn nên cân nhắc stream/disk.
  * ADMIN UI: form Thêm/Sửa nhạc & truyện & CHƯƠNG (thêm+sửa) ĐỔI TỪ POPUP -> panel INLINE (auto-scroll).
    Bảng admin: header nền slate-700 chữ trắng + kẻ sọc zebra + hover indigo-50 (globals.css, scope
    body.admin-shell). Bảng nhạc: click cả dòng -> mở form Sửa (ô actions stopPropagation).
  * UPLOAD: bỏ UploadThing trong UI admin (thiếu UPLOADTHING_TOKEN -> lỗi "Missing token"). Mọi upload
    ảnh/audio admin giờ qua BE R2: ảnh -> POST /upload/image; audio -> POST /upload/audio (folder='chapters'
    gửi qua FIELD multipart trong body, BE đọc @Body('folder') — KHÔNG phải query string).
    Đã đổi: HybridImageUploader (ads), ChapterForm thumbnail, BannerForm ảnh, VariantForm audio,
    StoryForm thumbnail (sẵn R2 từ trước). Các route /api/uploadthing/* + lib/uploadthing.ts còn nhưng KHÔNG dùng.
    MusicForm: thumbnail bấm-để-chọn (chỉ PNG/JPG/WEBP, preview vuông) + layout thumbnail|audio chia đôi;
    redesign section-card. Mọi <select> có chevron ⌄ qua rule CSS global `select.admin-input` (globals.css)
    -> ĐỪNG thêm icon chevron thủ công cho select admin-input (sẽ double).
  * PLAYER (web): HLS_SEGMENT_SECONDS=3, hls.js maxBufferLength=30, thanh buffered, formatDuration hh:mm:ss.
  * HLS TRUYỆN (chapter): trước KHÔNG chạy vì hls-r2.service downloadToFile chỉ R2 GetObject, mà audio
    chapter ở NGOÀI R2 (demo=soundhelix, upload mới=UploadThing). ĐÃ SỬA downloadToFile: URL thuộc R2 ->
    GetObject; URL ngoài -> fetch HTTP. Verify: chapter 000136de... -> 184 segment 3s, ready. Chapter là
    single-language (audioUrl/r2AudioUrl String đơn) nên "mỗi ngôn ngữ 1 HLS" tự thỏa (1 chapter=1 HLS).
    ĐÃ LÀM NỐT (như music): (a) ChapterForm upload audio -> R2 qua POST /upload/audio (folder='chapters' field body)
    (bỏ UploadThing cho audio; set vào r2AudioUrl); (b) expose hlsUrl cho chapter+variant ở GET
    /stories/:slug và GET /chapters/:id/public (HlsAsset.playlistUrl status=ready, query gộp tránh N+1,
    KHÔNG gate vì segment AES + key đã gated); web StoryChapterClient gắn hlsUrl vào track -> GlobalPlayer
    tự phát hls.js (proxy /chapters/:id/audio làm fallback). VERIFY: /chapters/:id/public trả hlsUrl,
    key endpoint 200 (chương free), m3u8+key CORS ok. HẠN CHẾ: chương TÍNH PHÍ -> hls.js fetch key không
    kèm token -> 403 (fallback proxy MP3 sau khi unlock); xử lý token cho key để dành phiên sau.
  * ĐỊNH DẠNG SỐ: util chung fe/apps/admin/src/lib/format-number.ts (formatThousand/parseThousand — số
    nguyên vi-VN có phân tách nghìn). Mọi ô GIÁ admin dùng type=text + formatThousand + onFocus select
    (đè số 0): MusicForm (Giá gốc/Giảm giá + giá track), StoryForm (unlockPrice/discountPercent),
    packages (priceVnd/pulseAmount), users (credits). Ô giá VIP chỉ bật khi accessType=vip (đúng thiết kế).
  * ĐỊNH DẠNG THỜI LƯỢNG: <1h -> mm:ss ; >=1h -> dd:hh:mm:ss (MusicForm + cột Thời lượng danh sách nhạc).
    Ô Thời lượng readonly, TỰ đọc từ file audio (handleAudioChange khi upload + effect đọc lại khi MỞ SỬA nếu thiếu).
  * ROW-CLICK MỞ SỬA: click cả dòng -> form Sửa ở bảng Nhạc / Danh mục / Tác giả (ô checkbox+actions stopPropagation).
  * MUSICFORM bố cục: cột trái = Thiết lập phát hành + Thông tin cơ bản; cột phải = Upload media + Giá mở khóa.
    Audio trái | Thumbnail phải (max-w-150px). Tags+Thời lượng cùng hàng. Comment chỉnh kích thước: search ">>>".
  * ADS form: full-width (w-full). Hàng 1 đối tác/ngôn ngữ/trạng thái (3 cột); hàng 2 tên SP/loại nội dung (2 cột);
    hàng 3 ảnh SP/link aff (2 cột, loại image). Ảnh preview = prop previewWidthClass của HybridImageUploader (ads w-1/2).
  * R2 CORS: bucket novel-audio đã set CORS (AllowedOrigins ["*"], GET/HEAD) để hls.js + ảnh fetch cross-origin từ FE.
    Set bằng token R2 quyền Admin (token app object-only bị 403 PutBucketCors) hoặc Cloudflare dashboard.

--- A. KHỞI ĐỘNG LẠI SAU KHI TẮT/RESTART MÁY (làm theo thứ tự) ---
  Hạ tầng KHÔNG tự chạy lại sau reboot — phải bật tay:
  1) MySQL: mở D:\SetupC\laragon\laragon.exe -> "Start All" (MySQL 3306).
     (Laragon đã chuyển sang D:; DB = audio_stories_dev, root không mật khẩu.)
  2) REDIS (portable, KHÔNG phải service — bắt buộc bật lại mỗi lần reboot):
     Start-Process "D:\SetupC\Tools\Redis\redis-server.exe" -ArgumentList "D:\SetupC\Tools\Redis\redis.windows.conf" -WindowStyle Hidden
     kiểm tra: D:\SetupC\Tools\Redis\redis-cli.exe ping  -> PONG
  3) Backend (cổng 3000):
     cd D:\SetupC\Projects\NovelApp\backend\be
     $env:TMP="D:\SetupC\Tools\tmp"; corepack yarn start:dev:nest
     (ĐỪNG dùng yarn api:dev — lỗi Node24 spawn .cmd. Xem mục 4.6.)
  4) Web (cổng 3001, vào /vi):
     cd D:\SetupC\Projects\NovelApp\backend\fe\apps\web
     corepack yarn dev
  Biến môi trường COREPACK_HOME/TMP/TEMP/YARN_* đã set ở User scope (ổ C đầy) -> giữ nguyên.
  5) Admin (cổng 3002): cd D:\SetupC\Projects\NovelApp\backend\fe\apps\admin ; corepack yarn dev
     - Đăng nhập: http://localhost:3002/vi/login (admin dùng [lang], KHÔNG có /login trần).
     - Tài khoản admin local: admin@truyen-audio.app / admin123 (reset bằng
       be/scripts/reset-admin.mjs <email> <pw> — mật khẩu gốc là argon2 hash không đọc được).
     - Đã tạo fe/apps/admin/.env trỏ NEXT_PUBLIC_API_URL=http://localhost:3000.
     - ĐÃ quét unwrap toàn app admin (helper fe/apps/admin/src/lib/api/unwrap.ts; 142 chỗ + fix
       login page bug `loginRes.data.ok` + admin-api-client refresh). tsc exit 0. Login & các trang
       stories/music/users/dashboard chạy với data thật.
  R2 (2026-06-29 đổi sang R2 MỚI "novel-audio", account 53b5f77f...): bucket novel-audio,
     public https://pub-ca26f31996334a31b9b0f3e8ed38ff96.r2.dev. be/.env + 3 FE .env (NEXT_PUBLIC_R2_URL)
     đã cập nhật; verify PutObject+GET 200 + upload Single qua /music ra link bucket mới. (R2 cũ
     audio-truyen-r2 không dùng nữa.) be/.env đã nối R2 — đã verify
     PutObject+GET 200 (be/scripts/r2-test.mjs). Upload qua POST /upload/audio (ADMIN) đẩy lên R2 thật.
     Secret nằm trong env/be (đã .gitignore). Xem docs/09-audio-pipeline.md.
  HLS PIPELINE — DÙNG HLS CỦA TEAM (TypeScript, KHÔNG Python). Code ở be/src/hls/ (BullMQ queue
     "hls-transcode" + ffmpeg qua Node execFile + AES-128 + bảng HlsAsset). Stub Python/audio-pipeline
     CŨ ĐÃ BỎ (xem mục 0). Transcode CHỈ chạy trong vai WORKER (HlsProcessor đăng ký khi APP_ROLE=worker).
     ffmpeg/ffprobe cấu hình qua FFMPEG_PATH/FFPROBE_PATH trong be/.env (mặc định 'ffmpeg'/'ffprobe' = PATH;
     local Windows trỏ D:\SetupC\Tools\ffmpeg\bin\*.exe). Segment dài HLS_SEGMENT_SECONDS (đang 3s).
     CHẠY WORKER LOCAL (dev-role.cjs hỏng trên Node24 — ĐỪNG dùng worker:dev):
       cd be ; nest build ; $env:APP_ROLE="worker"; $env:TMP="D:\SetupC\Tools\tmp"
       node_modules\.bin\dotenv.cmd -e .env -- node dist/main.js   (dotenv KHÔNG override APP_ROLE)
     ENQUEUE cho asset có sẵn (không cần re-upload):
       dotenv -e .env -- ts-node -r tsconfig-paths/register scripts/hls/enqueue.ts music <musicId>
     KIỂM TRA: node scripts/hls-status.mjs (list R2) ; SELECT status,playlist_url FROM hls_assets.
     ĐÃ VERIFY 2026-06-29: track music "1" -> 103 segment 3s, m3u8 + key AES-128, /music trả hlsUrl, key
     endpoint 200 (free). MP3 gốc GIỮ LẠI làm fallback + nguồn transcode lại.
  tsc typecheck FE: từ fe\apps\web chạy  ..\..\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json

--- B. ĐÃ LÀM TRONG PHIÊN NÀY ---
  1) Dựng chạy FULL local: import dump netviet_audio -> audio_stories_dev; chuyển Laragon
     C:->D: (backup ở D:\SetupC\Backups\laragon_all_*.sql); cài Redis portable.
  2) Fix BẢO MẬT/TIỀN (mục 6): ĐÃ FIX H1,H2,H3,H4,H5,H6(một phần),H8,H9. Xem dấu [✓].
  3) Fix lỗi unwrap {data} HỆ THỐNG (FE):
     - Tạo helper fe/apps/web/src/lib/api/unwrap.ts (unwrapList / unwrapData).
     - Quét 23 file (78 chỗ) bọc unwrap. Đã sửa thêm tay các chỗ sweep BỎ SÓT (set OBJECT,
       không phải mảng): HomePageClient, StoryDetailClient.setStory, StoryChapterClient
       (detail + /chapters/:id/public content), public-story-cache.fetchExploreCached (giữ .meta),
       explore/page.tsx (filter options).
     - GỐC: /stories/explore và /music BỌC 2 LỚP {data:{data:[...],meta}} ; object đơn bọc 1 lớp
       {data:{...}}. LUÔN unwrap qua helper.
  4) NHẬP DEMO DATA (D:\SetupC\Projects\NovelApp\content_demo):
     - Author "Trần Đăng Khoa" + 4 truyện CHỮ (Đảo Chìm, Chân Dung Và Đối Thoại, Người Thường Gặp,
       Tuyển Tập TĐK) = 53 chương (trích .doc bằng Word COM -> scratchpad\doc_txt).
     - Album Chế Linh: 10 music_tracks + 1 playlist. mp3 copy vào fe/apps/web/public/demo/audio/
       (audioUrl = http://localhost:3001/demo/audio/...). manifest ở scratchpad\music_manifest.json.
     - Script tái dùng: be/scripts/import-demo.mjs (idempotent). Chạy:
       cd be; $env:DATABASE_URL="mysql://root@127.0.0.1:3306/audio_stories_dev"; node scripts/import-demo.mjs
     - SAU KHI sửa DB trực tiếp -> FLUSH cache để explore hiện: redis-cli flushdb.

--- C. ĐANG DỞ / CẦN LÀM TIẾP ---
  [✓ DONE 2026-06-29] HLS music end-to-end (xem mục 0b). CÒN: chạy thử HLS cho CHAPTER/VARIANT
     (code đã wire registerAsset, chỉ cần asset có audio R2 + enqueue); cân nhắc CORS R2 cho hls.js
     fetch segment khi FE khác origin (R2 dev URL hiện trả 200, kiểm lại khi lên domain thật); với
     track TÍNH PHÍ, hls.js cần gửi token khi fetch /hls key (xhrSetup) — hiện chỉ verify track free.
  [✓ FIXED] Trang nhạc /vi/music: /music bọc 2 lớp {data:{data,meta}}. Đã sửa music/page.tsx:
     rows = unwrapList<MusicApiItem>(response.data); meta lấy response.data.data.meta (dòng ~126,141-143)
     + import unwrapList. tsc sạch. (Dòng 359 normalizeMusicItem(response.data.data) cho /music/:slug
     là single-wrap nên vẫn đúng — chưa đổi.)
  [LOW] /story/undefined: Next prefetch 1 <Link> có slug rỗng từ 1 card trên trang công khai
     (benign, trả 200 not-found, không crash). Cách triệt để: guard link giống StoryListView
     (href "#" khi !slug) cho các card/grid trong components/shared & components/story.
  [BACKLOG] Nhóm ƯU TIÊN TRUNG M1–M17 và THẤP L1–L10 (xem mục 6 + docs/07-quy-tac-code.md):
     god-services, tách schema, cache categories sai, throttler Redis, dọn code chết...
  [TUỲ CHỌN] Tiêu đề nhạc đang KHÔNG DẤU (theo tên file). Gán thể loại cho 4 truyện TĐK
     (categories rỗng). Cover thật thay placeholder picsum.

--- D. (2026-07-01) FIX BE ƯU TIÊN CAO + BUILD APP MOBILE FLUTTER (novelverse) ---
  BACKEND (be/) — đã fix, tsc EXIT=0, BE boot api role OK (healthz 200, mọi endpoint /en 200):
    * H6 [✓ full]: Casso webhook chống-replay — thêm isFreshTimestamp (tolerance 5' hằng số,
      KHÔNG thêm env; casso-webhook.controller.ts).
    * H7 [✓]: chặn login khi isActive=false (auth.service.loginLocal) + jwt-access.strategy
      select isActive & từ chối token khi khoá + endpoint admin PATCH /auth/users/:id/active
      (setUserActive, revoke refresh khi khoá). Cột is_active CÓ trong DB (đã verify).
    * H10 [✓]: transactions.deletePayment khớp referenceId cả payment.id LẪN providerPaymentId
      (Stripe lưu session.id), claw-back Pulse trong $transaction + ghi dòng refund audit.
    * Feature: POST /auth/change-password (password.service.changePassword, revoke sau đổi).
    * Rate-limit: @Throttle cho login/register/verify-email/verify-code/resend*/forgot/reset/
      change-password (5–10 req/5') — auth.controller.ts.
    * Cron huỷ đơn VietQR PENDING quá hạn: vietqr.service.cancelExpiredOrders @Cron 5' (chỉ vai
      scheduler; inert ở api/worker).
    * L4: /auth/me chỉ trả _debug khi NODE_ENV!=production. L8: social-links @Roles('ADMIN').
    * DỞ: be/src/roles/dto/{create,update}-role.dto.ts đã tạo nhưng RolesModule/controller/service
      CHƯA wire (bị dừng) → file mồ côi, KHÔNG import ở đâu, không ảnh hưởng boot. Làm nốt hoặc xoá.
    * Doc mới: docs/10-mobile-api.md = HỢP ĐỒNG API cho app mobile (base URL theo môi trường/VPS,
      envelope {data,meta}, auth Bearer + refresh header x-refresh-token, danh sách endpoint mobile,
      ánh xạ 1-1 với novelverse/lib/api/api_endpoints.dart). Đã thêm vào docs/README.md.

  APP MOBILE FLUTTER — D:\SetupC\Projects\NovelApp\novelverse (client của hệ này):
    * Là Flutter app (Dart, provider + go_router + audioplayers), TÁCH RIÊNG khỏi be/fe.
    * Đã VIẾT DOCS đầy đủ: novelverse/docs/ (01 kiến trúc … 07 nối backend) + README mỗi thư mục
      lib/ (api/data/state/theme/widgets/screens/*). first_readme của app: chính là docs/README.md đó.
    * Đã TÍCH HỢP BACKEND (mã ở novelverse/lib/):
        - api/: api_env.dart (CẤU HÌNH DOMAIN/IP theo dev/staging/prod, đổi 1 chỗ khi lên VPS;
          cờ USE_BACKEND dart-define, mặc định FALSE = chạy Demo tĩnh), api_endpoints.dart (mọi path),
          api_client.dart (dio: bóc {data,meta}, Bearer, auto-refresh 401, resolveRedirect cho audio,
          postRaw đọc Set-Cookie), token_store.dart (flutter_secure_storage), api_exception.dart.
        - data/: repositories stories(explore/detail/chapterContent)/music/audio/auth + mappers.
        - state/: AsyncValue + StoriesNotifier/MusicNotifier/AuthNotifier (fallback Demo khi lỗi/tắt BE).
        - Màn đã wire: Discover, Novel Home, Audio Home, Audio Library, BookDetail, Reader (nội dung +
          nút nghe chương), Login, Profile (user thật + đăng nhập/đăng xuất).
        - Audio thật: resolveRedirect GET /chapters/:id/audio (302, kèm Bearer) → phát URL (UrlSource).
          HLS+key AES-128 CHƯA làm (cần just_audio); MP3 proxy phủ cả chương trả phí.
        - Auth mobile: access ở body, refresh đọc từ Set-Cookie khi login → secure storage → gửi lại
          header x-refresh-token khi /auth/refresh. restore() lúc mở app.
    * Deps thêm: dio, shared_preferences, flutter_secure_storage.
    * BUILD: Flutter cài ở D:\SetupC\flutter (flutter.bat). `flutter pub get` OK; `flutter analyze`
      = 0 LỖI, 38 info-lint cosmetic (unnecessary_underscores (_,__), dangling doc, deprecated
      RadioListTile) → BIÊN DỊCH ĐƯỢC. Chạy: flutter run --dart-define=USE_BACKEND=true (BE ở :3000).
    * CÒN LẠI: Trending/charts/album/player nhạc; HLS just_audio; đăng ký/verify UI; đồng bộ Pulse
      sau unlock (AuthNotifier.refreshUser + /chapters/:id/unlock-by-pulse); billing; cache hive; wire RolesModule.

  CHẠY LẠI 3 SERVER (2026-07-01 đã verify tất cả 200): Redis+MySQL nền OK. BE start:dev:nest (:3000),
  web next dev (:3001 /en), admin next dev (:3002 /vi/login). Nếu /en "không chạy" → thường do CHƯA
  bật server (curl trả 000), KHÔNG phải lỗi code (đã kiểm: BE boot sạch, mọi endpoint công khai 200).

--- E. (2026-07-01) APP UI THEO THIẾT KẾ + I18N + NGÔN NGỮ NỘI DUNG + FE i18n gom ---
  APP (novelverse): xem CHANGELOG chi tiết ở novelverse/CHANGELOG.md. Tóm tắt:
    * NGÔN NGỮ NỘI DUNG (AppState.contentLang, mặc định 'en', lưu máy): lọc stories (lang=)
      + categories (language=), đổi là reload, cache tách theo ngôn ngữ. ⚠ AUDIO KHÔNG lọc
      ngôn ngữ: BE Music KHÔNG có languageId, /music không nhận lang → chọn EN vẫn hiện nhạc VN.
      Muốn lọc audio phải sửa BE: thêm Music.languageId + migration/backfill + MusicQueryDto.lang
      + filter; rồi app gửi lang ở MusicRepository. (stories/categories đã có languageId + lọc lang.)
    * I18N HIỂN THỊ: dựng lib/l10n/ (gen-l10n + ARB app_en/app_vi) + context.l10n.*; áp bottom nav,
      toggle Novel/Audio, Language Settings. Ngôn ngữ hiển thị (uiLang) tách ngôn ngữ nội dung (contentLang).
    * CATEGORY thật từ BE (/stories/categories, cùng nguồn web) — Discover chip thể loại + lọc categoryId.
    * AUDIO just_audio: ưu tiên HLS Cloudflare (hlsUrl, kèm Bearer key/segment), fallback MP3 cache +
      proxy 302; preload 30s; next/prev wrap; buffer bar + formatClock.
    * CACHE: cached_network_image (thumb), json_cache prefs+TTL10' SWR (stories/music), LockCaching audio.
    * UI thiết kế (anh/*.png): Home (Reading header + Editor's hero + Continue + View All + Today),
      Reader (appbar 🎧/🔖/Aa/☰, tên chương giữa, comment bubble/đoạn, Reading settings chi tiết
      5 nền/màu/A±/font/line/margin, menu dưới 4 tab AUTO-HIDE theo cuộn, thanh read-along, End of Chapter).
    * Khóa dọc (portrait). Build APK: fix SSL Avast (gradle.properties trustStore), AGP align, cleartext.
      Flutter ở D:\SetupC\flutter; cài máy test qua adb (bật Install via USB trên MIUI).

  FE WEB (backend/fe): GOM CONFIG LOCALE 1 nguồn packages/shared/src/i18n.ts; apps/web + apps/admin
    src/i18n.ts chỉ `export * from "@audio-stories/shared/i18n"` (giữ import @/i18n). Chuỗi dịch vẫn ở
    messages/{en,vi}.json (next-intl). Verify web:3001 + admin:3002 vẫn 200 sau đổi.
    ⇒ Thêm/bớt ngôn ngữ hiển thị FE: sửa locales 1 chỗ (shared) + thêm messages/<code>.json mỗi app.

  BE: doc hợp đồng mobile docs/10-mobile-api.md. CHƯA làm: Music.languageId (để audio theo ngôn ngữ).

================================================================================
 HẾT — quay lại đây bất cứ khi nào mất ngữ cảnh.
================================================================================
