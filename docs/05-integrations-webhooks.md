# 05 — Tích hợp ngoài, Thanh toán & Webhook

> VÙNG: Billing/Payment + tích hợp bên thứ ba (Stripe, VietQR, Casso, UploadThing,
> Cloudflare R2/S3, SMTP) + coin (Pulse) packages + membership/VIP + credit transactions.
> Tài liệu viết dựa trên ĐỌC CODE THẬT (cập nhật 2026-06-29). Tin code hơn tin doc nếu mâu thuẫn.
> ⚠ Một số cạm bẫy cũ (double-credit Stripe, Casso không timing-safe, không set `provider`) ĐÃ ĐƯỢC FIX
>   trong code — phần dưới đã cập nhật trạng thái. Đọc kỹ mục 2, 3 và mục 11 (điểm cần lưu ý khi sửa).
> Đơn vị tiền tệ nội bộ của app là **Pulse** (coin ảo). 1 lần nạp = mua 1 "package" → cộng Pulse.

---

## 0. BẢN ĐỒ NHANH (đọc 30 giây)

| Luồng | Ai gọi | Endpoint vào | Service xử lý | Kết quả |
|---|---|---|---|---|
| Tạo phiên Stripe | User (FE) | `POST /billing/create-checkout-session` | `StripeService.createCheckoutSession` | trả `session_id`, `url` (redirect sang Stripe) |
| Stripe báo đã trả | Stripe → BE | `POST /billing/webhook/stripe` | `StripeService.handleWebhookEvent` + `WebhookService.processStripeEvent` | cộng Pulse + tạo Payment + CreditTransaction |
| Verify Stripe thủ công | User (FE) sau redirect | `GET /billing/verify-payment?session_id=` | `StripeService.verifyAndProcessPayment` | cộng Pulse (đường DỰ PHÒNG; nay CHỐNG TRÙNG bằng `session.id` + P2002) |
| Tạo đơn VietQR | User (FE) | `POST /billing/vietqr/create-order` (alias `/order`) | `VietQRService.createOrder` | trả QR image + transactionCode + hạn 30'  |
| Bank về tiền | Casso → BE | `POST /billing/webhook/casso` | `CassoWebhookController` + `VietQRService.processPayment` | match đơn theo `ORDER:xxxx` → cộng Pulse |
| Kiểm tra đơn VietQR | User (FE) polling | `GET /billing/vietqr/order/:orderId/status` | `VietQRService.checkOrderStatus` | trả status + `is_expired` |
| CRUD gói nạp | Admin | `/packages` (GET công khai, POST/PATCH/DELETE admin) | `PackagesService` | lưu JSON trong `site_settings` |
| Lịch sử giao dịch của tôi | User | `GET /transactions/my` | `TransactionsService.findMyTransactions` | gộp Payment + CreditTransaction |
| Tặng Pulse | User | `POST /transactions/donate` | `TransactionsService.donatePulse` | trừ Pulse + ghi CreditTransaction `spend` |
| Quản trị membership | Admin | `/memberships` | `MembershipsService` | CHỈ đọc/xoá (KHÔNG có tạo — xem cạm bẫy) |
| Upload audio/ảnh | Admin | `POST /upload/audio`, `POST /upload/image` | `AudioUploadService` (R2), `ImageUploadService` (R2) | trả `{ url }` |
| Xoá tệp R2 | Admin | `POST /upload/delete` | `AudioUploadService.deleteByUrl` | xoá object R2 theo URL (dùng chung ảnh+audio) |

**Prefix toàn cục**: KHÔNG có `/api` global prefix ở dự án này (khác CRM). Route trong code = route thật.
Ví dụ `@Controller('billing')` → `POST /billing/create-checkout-session`.

---

## 1. KIẾN TRÚC TIỀN TỆ — "Pulse" coin

- Người dùng nạp tiền thật (VND qua VietQR / USD qua Stripe) → nhận **Pulse** (coin ảo).
- Số dư lưu ở `User.pulseBalance` (Int, unsigned).
- Mỗi lần cộng/trừ Pulse PHẢI ghi 1 dòng `CreditTransaction` (sổ cái, có before/after).
  - `type='topup'` khi nạp (amount dương).
  - `type='spend'` khi tiêu: mở khoá chương, tặng (amount ÂM).
- Pulse dùng để: mở khoá chương trả phí (`chapters.service.ts` → `unlockChapter`), donate.
  - Tham khảo logic mở khoá: `be/src/chapters/chapters.service.ts:330-424`.

**Model liên quan** (`be/prisma/schema.prisma`) — ⚠ NHIỀU CỘT DB CÒN TÊN CŨ (đổi Credit→Pulse dở):
- `CreditTransaction` (dòng 715) — sổ cái Pulse. Field Prisma → cột DB:
  `pulseAmount → amount`, `pulseBalanceBefore → balance_before`, `pulseBalanceAfter → balance_after`,
  `referenceId → reference_id`. Enum `CreditTransactionType` (dòng 708) = `topup | spend | refund | admin_adjust`
  (code HIỆN chỉ dùng `topup` và `spend`; `refund`/`admin_adjust` chưa được dùng ở đâu).
- `Payment` (dòng 755) — đơn nạp tiền (Stripe/VietQR). Cột cũ: `pulseAdded → credits_added`.
  Default: `provider = VIETQR`, `status = PENDING`, `currency = 'VND'`. `expiresAt` BẮT BUỘC (NOT NULL).
  ★ `@@unique([provider, providerPaymentId])` (dòng 782) = XƯƠNG SỐNG chống double-credit Stripe
    (P2002 khi 2 đường cùng ghi `session.id`). Có sẵn index `[status, expiresAt]` (sẵn sàng cho cron huỷ đơn).
- Enum trong `payment.enum.ts` (TS, dùng cho DTO/validate) KHÁC enum Prisma:
  - `PaymentProvider` (TS) = `STRIPE | VIETQR | MANUAL`; còn Prisma `PaymentProvider` = `STRIPE | VIETQR | PAYPAL | MANUAL`.
  - `PaymentStatus` (cả TS lẫn Prisma) có CẢ `SUCCESS` LẪN `SUCCEEDED` (+ PROCESSING/FAILED/CANCELLED/
    REFUNDED/PARTIALLY_REFUNDED/REQUIRES_ACTION/REQUIRES_PAYMENT_METHOD). ⚠ CODE THỰC TẾ chỉ ghi/đọc
    `SUCCESS` (không bao giờ `SUCCEEDED`). Khi filter/thống kê đừng quên đây là 2 giá trị KHÁC NHAU —
    `SUCCEEDED` là rác enum dễ gây nhầm.
- `WebhookEvent` (dòng 791) — log idempotency webhook. `@@unique([provider, eventId])`.
- `Membership` (dòng 816) — gói hội viên/VIP theo tác giả. `MembershipType` = `all_authors|specific_author`.
- `SiteSetting` (dòng 868) — key/value; gói nạp lưu ở key `payment_packages` (JSON).

---

## 2. STRIPE (thẻ quốc tế, USD)

**File**: `be/src/billing/services/stripe.service.ts`,
`be/src/billing/controllers/billing.controller.ts`,
`be/src/billing/controllers/stripe-webhook.controller.ts`,
`be/src/billing/services/webhook.service.ts`.

### 2.1 Khởi tạo
- SDK `stripe` khởi tạo trong constructor nếu có `STRIPE_SECRET_KEY`; nếu thiếu → `stripe=null`,
  mọi thao tác ném `BadRequestException('Stripe is not configured')` (`ensureStripe`).
- `apiVersion: '2024-12-18.acacia'` (hardcode, ép kiểu `as any`).

### 2.2 Tạo checkout session — `POST /billing/create-checkout-session` (JwtAccessGuard)
Body `CreateCheckoutSessionDto`: `package_code` (bắt buộc), `provider?` (mặc định STRIPE — KHÔNG dùng),
`success_url?`, `cancel_url?`. Logic (`stripe.service.ts:35`):
1. Tìm gói qua `PackagesHelperService.findByCode` (đọc JSON `site_settings.payment_packages`).
2. Quy đổi VND→USD: `amountUsd = round(priceVnd / USD_TO_VND_RATE * 100)` cent. Mặc định rate=25000.
3. **Chặn cứng** nếu `< 50` cent (Stripe min 0.5 USD) → ném lỗi song ngữ.
4. Lấy/ tạo Stripe Customer: lưu `User.stripeCustomerId`. Có self-heal: nếu customer cũ bị xoá
   trên Stripe (`resource_missing`) → tạo mới.
5. Tạo session `mode='payment'`, `line_items` dùng `price_data` (tạo product ad-hoc), gắn
   `metadata.user_id` + `metadata.package_code`.
6. Trả `{ session_id, url }`. FE redirect sang `url`.

### 2.3 Webhook Stripe — `POST /billing/webhook/stripe` (KHÔNG guard, verify chữ ký Stripe)
`stripe-webhook.controller.ts`:
- Cần **raw body** (`req.rawBody`, `RawBodyRequest<Request>`). Nếu thiếu → trả `{received:false}`.
  ⚠ Phải bật `rawBody: true` khi tạo Nest app (xem `main.ts`) để route này nhận Buffer.
- `StripeService.handleWebhookEvent(rawBody, signature)`:
  - Verify bằng `stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET)`.
    Thiếu secret → ném lỗi. Đây là verify chữ ký THẬT (HMAC qua SDK).
  - Lưu `WebhookEvent` (upsert theo `provider_eventId`), bỏ qua lỗi unique (idempotency log).
- `WebhookService.processStripeEvent(event)` switch theo `event.type`:
  - `checkout.session.completed` → `handleCheckoutCompleted` (đường CHÍNH cộng Pulse).
  - `payment_intent.succeeded` / `payment_intent.payment_failed` → chỉ log, KHÔNG xử lý.
  - Cuối cùng đánh dấu `WebhookEvent.processed=true` (`updateMany` theo `eventId`).
- `handleCheckoutCompleted` (`webhook.service.ts:53`):
  1. Đọc `metadata.user_id`, `metadata.package_code`; thiếu → bỏ qua.
  2. Idempotency (lớp 1): `payment.findFirst` theo **`provider:'STRIPE'` + `providerPaymentId: session.id`**;
     đã có → return.
  3. `$transaction`: tạo `Payment(provider:'STRIPE', providerPaymentId: session.id, status='SUCCESS')`
     + `user.pulseBalance += pulseAmount` + `CreditTransaction(type=topup, referenceId: session.id)`.
     ⚠ Idempotency (lớp 2 — chống race): bọc `try/catch`, gặp `P2002` (vi phạm UNIQUE
     `(provider, providerPaymentId)`) → log + `return` (KHÔNG cộng trùng).
  4. Tạo notification (`createPaymentNotification`) + gửi mail (nếu `user.allowEmailNoti`).

### 2.4 Verify thủ công — `GET /billing/verify-payment?session_id=` (JwtAccessGuard)
`stripe.service.ts:170` — gọi sau khi user quay về `success_url`:
- `stripe.checkout.sessions.retrieve(sessionId)`, kiểm tra `metadata.user_id === userId`.
- Nếu `payment_status !== 'paid'` → trả `success:false`.
- Idempotency (lớp 1): `payment.findFirst` theo `provider:'STRIPE'` + `providerPaymentId: session.id`.
- Nếu chưa có → CỘNG PULSE trong `$transaction` (lặp lại đúng logic của webhook), bọc `try/catch`
  bắt `P2002` (lớp 2 chống race). **Đây là đường DỰ PHÒNG** (phòng khi webhook chưa về).

> ✅ **(ĐÃ FIX 2026-06) double-credit Stripe**: cả webhook `handleCheckoutCompleted` và
> `verifyAndProcessPayment` nay dùng CÙNG idempotency key = **`session.id`** (Checkout Session id —
> ỔN ĐỊNH, giống nhau ở cả 2 đường, không còn `payment_intent || session.id`). Thêm cột thứ 2:
> cả 2 đường `create` Payment với `@@unique([provider, providerPaymentId])` rồi bắt `P2002` →
> nếu đường kia đã ghi cùng `session.id` thì cả `$transaction` (gồm `pulseBalance increment`) ROLLBACK
> → KHÔNG cộng Pulse 2 lần, kể cả khi 2 request chạy song song. (Trước đây chỉ `findFirst` → có race.)
> Khi sửa tiếp: GIỮ `session.id` là key duy nhất ở cả 2 nhánh; đừng đổi lại sang `payment_intent`.

> ✅ **(ĐÃ FIX) set `provider`**: cả 2 đường nay set `provider:'STRIPE'` khi `payment.create`
> (không còn để rơi về default `VIETQR`) → thống kê theo provider đã đúng cho Stripe.
> ⚠ Lưu ý còn lại: `referenceId` của `CreditTransaction` Stripe = `session.id` (KHÔNG phải `payment.id`)
>   → ảnh hưởng tới `deletePayment` (xem mục 6, cạm bẫy orphan vẫn còn).

---

## 3. VIETQR (chuyển khoản ngân hàng VN) + CASSO (đối soát)

**File**: `be/src/billing/services/vietqr.service.ts`,
`be/src/billing/controllers/vietqr.controller.ts`,
`be/src/billing/controllers/casso-webhook.controller.ts`.

### 3.1 Cấu hình
`VietQRService.isConfigured` = có đủ `bankId` + `accountNo` + `accountName`
(đọc qua `AppConfigService.payment.vietqr`, map từ env `VIETQR_*`). Thiếu → ném
`BadRequestException('VietQR is not configured')`.

### 3.2 Tạo đơn — `POST /billing/vietqr/create-order` (và alias `POST /billing/vietqr/order`)
(`vietqr.service.ts:33`, JwtAccessGuard):
1. Tìm gói (`findByCode`), `amountVnd = pkg.priceVnd`.
2. `orderId = uuidv4()`; `addInfo = 'ORDER:' + 8 ký tự đầu uuid (UPPERCASE)` → đây là
   **nội dung chuyển khoản** để đối soát.
3. Gọi `generateQRCode(amount, addInfo)`: fetch ảnh PNG từ
   `https://img.vietqr.io/image/{bankId}-{accountNo}-{template}.png?amount=&addInfo=&accountName=`
   → trả base64 data URI. Thất bại → `qr_image=null` (không ném lỗi).
   ⚠ `qr_emv` LUÔN `null` (chưa implement EMV string). FE chỉ có ảnh.
4. Tạo `Payment(status=PENDING)` với `id=orderId`, `transactionCode=addInfo`,
   `expiresAt = now + 30 phút` (HARDCODE — xem cạm bẫy), `pulseAdded=pkg.pulseAmount`,
   `qrData = qr_emv` (LUÔN null), `qrImageBase64 = qr_image`.
   ⚠ KHÔNG set `provider` ở VietQR `create` → rơi về default schema (`VIETQR`) — TÌNH CỜ đúng,
     nhưng nên set tường minh khi refactor.
5. Trả về (snake_case): `order_id`, `transaction_code`, `amount_vnd`, **`pulse`** (= `pulseAdded`),
   `qr_image`, **`qr_data`** (= null), `expires_at`, `bank_info` (gồm `pulse`, `account_no`, `account_name`).

### 3.3 Kiểm tra trạng thái — `GET /billing/vietqr/order/:orderId/status` (JwtAccessGuard)
`checkOrderStatus`: trả `status`, `paid_at`, `expires_at`, `is_expired` (tính runtime:
`now > expiresAt && status==='PENDING'`). FE thường poll endpoint này.
⚠ Không kiểm tra đơn có thuộc về user gọi không (orderId là uuid khó đoán nhưng vẫn nên scope).

### 3.4 Webhook Casso — `POST /billing/webhook/casso` (KHÔNG JwtGuard, tự verify HMAC)
`casso-webhook.controller.ts`:
- Nhận header `x-casso-signature` dạng `t=<timestamp>,v1=<hash>`.
- `verifySignature`: tính HMAC-**SHA512** với secret = env `CASSO_SECURE_TOKEN`, THỬ 3 format
  payload: `timestamp.payload`, `payload`, `timestamp+payload`; khớp 1 trong 3 → hợp lệ.
  ✅ So sánh hash nay dùng `safeEqualHex` = `crypto.timingSafeEqual` (constant-time, đã hết
  timing side-channel — xem cạm bẫy bên dưới đã cập nhật).
- Payload `{ error, data }`. `data` là 1 giao dịch ngân hàng (số tiền, description, reference...).
- Idempotency: upsert `WebhookEvent(provider='casso', eventId=reference||id)` (bọc try/catch,
  bỏ qua nếu bảng chưa có).
- Trích mã đơn từ `data.description` bằng regex `/ORDER:([A-Z0-9]+)/i` → `transactionCode`.
- Gọi `VietQRService.processPayment(transactionCode, amount, bankTransactionId)`:
  - Tìm `Payment` theo `transactionCode + status='PENDING'`.
  - **Verify số tiền** với dung sai 1%: `|amount - amountVnd| > amountVnd*0.01` → bỏ (mismatch).
  - `$transaction`: `Payment.status=SUCCESS` + `paidAt` + `bankTransactionId`; `user.pulseBalance +=`;
    `CreditTransaction(type=topup)`.
  - Notification + mail (nếu `allowEmailNoti`).
- Đánh dấu `WebhookEvent.processed=true` sau khi xử lý.

> ⚠ **CẠM BẪY bảo mật Casso (cập nhật — còn lại sau khi đã fix timing-safe)**:
> 1. ✅ (ĐÃ FIX) so sánh hash nay dùng `safeEqualHex`/`crypto.timingSafeEqual` (constant-time).
>    ⚠ NHƯNG vẫn THỬ 3 format payload (`timestamp.payload`, `payload`, `timestamp+payload`) →
>    nới lỏng yêu cầu chữ ký. Nên chốt đúng 1 format chuẩn theo tài liệu Casso khi refactor.
> 2. (CÒN) KHÔNG kiểm tra `timestamp` còn hạn (replay attack: gửi lại payload + chữ ký cũ).
> 3. (CÒN) In ra log `Signature`, `Payload`, `Timestamp` (rò rỉ thông tin nhạy cảm trong log).
> 4. (CÒN) Trả `200` cho mọi trường hợp (kể cả chữ ký sai → `{success:false,error:'Invalid signature'}`) —
>    đúng kỳ vọng "không retry" của Casso, nhưng làm khó phát hiện tấn công.
> 5. (CÒN) Idempotency theo `WebhookEvent` chỉ là LOG; chống nạp-trùng thật sự dựa vào
>    `status='PENDING'` (đã SUCCESS thì `findFirst` không thấy → bỏ qua). Ổn nhưng mong manh
>    nếu có 2 webhook đồng thời cùng đơn (race) vì không khoá hàng/transaction-level lock.

> ⚠ **CẠM BẪY hết hạn đơn (THIẾU CHỨC NĂNG QUAN TRỌNG)**:
> - Đơn VietQR set `expiresAt = now + 30 phút` **HARDCODE** trong `vietqr.service.ts:59`.
> - Env `VIETQR_ORDER_EXPIRY_MINUTES` (mặc định gợi ý 15') ĐƯỢC parse vào config
>   (`app-config.schema.ts:81,257`, `cfg.payment.vietqr.orderExpiryMinutes`) nhưng **KHÔNG
>   nơi nào dùng** → giá trị env vô tác dụng.
> - **KHÔNG có CRON huỷ đơn quá hạn**: grep toàn `src` chỉ thấy `is_expired` tính runtime;
>   không có job chuyển `PENDING → CANCELLED/FAILED` khi quá `expiresAt`. Đơn quá hạn nằm mãi
>   ở `PENDING`. (Khác hẳn dự án CRM tham chiếu vốn có cron mỗi phút huỷ đơn + hoàn kho.)
>   Hệ quả: nếu tiền về MUỘN sau "30 phút", `processPayment` vẫn match (vì chỉ lọc theo
>   `status='PENDING'`, không lọc `expiresAt`) → vẫn cộng Pulse. Tức "hết hạn" hiện chỉ là
>   hiển thị, không có hiệu lực nghiệp vụ. Cần thống nhất: hoặc cron huỷ thật, hoặc bỏ khái niệm hạn.

---

## 4. COIN PACKAGES (gói nạp Pulse)

**File**: `be/src/packages/*` + `be/src/billing/services/packages-helper.service.ts`.

- Gói **KHÔNG có bảng riêng** — lưu dạng mảng JSON trong `SiteSetting` key=`payment_packages`.
- 2 nguồn đọc gói SONG SONG (cùng đọc `site_settings.payment_packages`, parse JSON, lỗi → `[]`):
  - `PackagesService.findAll(lang?)` (`packages.service.ts`) — phục vụ controller `/packages`, CÓ lọc locale.
  - `PackagesHelperService.findAll()` / `findByCode(code)` (`billing/services/packages-helper.service.ts`)
    — phục vụ billing (Stripe/VietQR), KHÔNG nhận `lang`, KHÔNG lọc locale.
- ⚠ Hai interface gói LỆCH NHAU:
  - `PackagesHelperService.PaymentPackage` (billing) CHỈ có: `code`, **`name`** (bắt buộc), `priceVnd`,
    `pulseAmount`, `description?`, `isActive`, `displayOrder`. → billing chỉ đọc các field này.
  - `CreatePackageDto` (`packages` module) RỘNG hơn: thêm `name?`/`nameVi?`/`nameEn?`, `price?`, `currency?`,
    `lang?`, `description*Vi/En?`, `isPopular?`, `isBestValue?`. → các field này được LƯU vào JSON nhưng
    billing helper KHÔNG đọc (vd `nameVi` không ảnh hưởng tên sản phẩm Stripe — Stripe đọc `name`).

### Endpoints `/packages`
| Method | Route | Guard | Logic |
|---|---|---|---|
| GET | `/packages?lang=` | công khai | `findAll(lang)` — lọc theo locale linh hoạt (xem dưới) |
| POST | `/packages` | ADMIN | thêm gói (check trùng `code` → 409) |
| PATCH | `/packages/:code` | ADMIN | merge update theo `code` |
| DELETE | `/packages/:code` | ADMIN | xoá theo `code` |

- Lọc locale (`PackagesService.findAll`): khớp nếu `pkg.lang===lang` HOẶC gói có nội dung
  bản địa (`nameVi/descriptionVi` cho `vi`, `nameEn/descriptionEn` cho `en`). Nếu lọc ra rỗng
  → trả TOÀN BỘ (fallback chống vỡ UI).

> ⚠ **CẠM BẪY packages (cần refactor)**:
> - Lưu JSON trong 1 row `site_settings` → KHÔNG có khoá/giao dịch. 2 admin sửa đồng thời =
>   last-write-wins, mất dữ liệu. Không index, không truy vấn được theo gói.
> - `description` của setting bị **mojibake** (`'Danh sÃ¡ch cÃ¡c gÃ³i...'` —
>   `packages.service.ts:96`): chuỗi tiếng Việt bị lỗi encoding khi tạo setting.
> - `PaymentPackage` interface (helper) bắt buộc `name`, nhưng `CreatePackageDto.name` lại
>   optional → gói tạo không có `name` sẽ làm Stripe fallback `'<pulseAmount> Pulse Package'`.
> - Không validate `priceVnd` đủ lớn để qua ngưỡng Stripe 50 cent ngay lúc tạo gói → user
>   chọn gói nhỏ mới bị chặn lúc checkout.

---

## 5. MEMBERSHIP / VIP

**File**: `be/src/memberships/*`. Model `Membership` + `User.vipTier`/`User.vipExpirationDate`.

### 5.1 Hai khái niệm KHÁC NHAU (đừng lẫn)
- **VIP** (gate mở khoá chương): dựa trên `User.vipTier > 0` và `vipExpirationDate` chưa hết hạn.
  Logic kiểm ở `chapters.service.ts:356-367` — nếu là VIP thì mở khoá chương `accessType='vip'`
  (và timed) MIỄN PHÍ (charged=0).
- **Membership** (model): gói hội viên theo tác giả — `type=all_authors | specific_author`,
  `startDate/endDate`, `pulseSpent`. Dùng để theo dõi quyền truy cập theo tác giả.

### 5.2 Endpoints `/memberships` (TẤT CẢ: JwtAccessGuard + RolesGuard + @Roles('ADMIN'))
| Method | Route | Logic |
|---|---|---|
| GET | `/memberships` | list + filter `type`, `status=active|expired` (theo `endDate` vs now), search user/author |
| GET | `/memberships/stats` | đếm tổng / active / expired / all_authors / specific_author |
| DELETE | `/memberships/:id` | xoá 1 membership |

### 5.3 Cron nhắc hết hạn — `MembershipsService.sendMembershipExpiryReminders` (`@Cron EVERY_HOUR`)
- Quét membership `endDate` trong khoảng `(now, now+72h]`, lấy tối đa 500.
- Tính mốc nhắc 24/48/72 giờ (`resolveReminderHour`).
- Chống gửi trùng: kiểm `Notification(type='membership_expiry')` cùng title trong 23h gần đây.
- Gửi bell-noti (createMany, skipDuplicates) nếu `allowBellNoti`; gửi email
  (`MailService.sendMembershipExpiryReminder`) nếu `allowEmailNoti`.

> ⚠ **CẠM BẪY membership lớn nhất (THIẾU LUỒNG MUA)**:
> - Grep toàn `src`: **KHÔNG có `prisma.membership.create` ở bất cứ đâu**. Tức là KHÔNG có
>   endpoint/luồng nào để USER MUA membership (trừ Pulse → tạo Membership). Module memberships
>   hiện chỉ ADMIN đọc/xoá + cron nhắc hết hạn → **luồng mua membership đang THIẾU / chưa code**.
> - Tương tự, KHÔNG thấy code nào set `User.vipTier`/`vipExpirationDate` (cần grep module
>   user/admin riêng để xác nhận; trong vùng billing thì không có). VIP và Membership hiện
>   chưa được "bán" qua billing — billing chỉ nạp Pulse.
> - `MembershipsController` không có route tạo → việc tạo (nếu có) nằm ngoài vùng này.

---

## 6. CREDIT (PULSE) TRANSACTIONS

**File**: `be/src/transactions/*`.

### Endpoints `/transactions` (controller có `@UseGuards(JwtAccessGuard)` toàn bộ)
| Method | Route | Guard thêm | Logic |
|---|---|---|---|
| GET | `/transactions/my` | (user) | gộp Payment + CreditTransaction của user, sort desc, phân trang trong RAM |
| POST | `/transactions/donate` | (user) | `donatePulse`: trừ Pulse, ghi CreditTransaction `spend` (amount âm) |
| GET | `/transactions/gifts` | ADMIN | CreditTransaction `type=spend` + description chứa `'Tặng'` |
| GET | `/transactions/payments` | ADMIN | list Payment + filter status/search |
| GET | `/transactions/stats` | ADMIN | tổng doanh thu (sum amountVnd SUCCESS) + đếm SUCCESS/PENDING/FAILED |
| DELETE | `/transactions/payments/:id` | ADMIN | xoá Payment + CreditTransaction liên quan (theo `referenceId=id`) |

- `userIdFromAccount` chấp nhận cả `account.id` lẫn `account.sub` (JWT payload không đồng nhất).
- `donatePulse` (`transactions.service.ts:228`): check `pulseBalance >= amount`, dùng `$transaction`
  callback (decrement + tạo CreditTransaction). DTO `DonateDto`: `amount` (Int dương), `description`.

> ⚠ **CẠM BẪY transactions (cần refactor)**:
> - `findMyTransactions` lấy `take:200` mỗi nguồn rồi gộp + phân trang TRONG BỘ NHỚ → quá
>   200 giao dịch sẽ THIẾU dữ liệu / phân trang sai. `safeLimit` cap 50 nhưng tổng vẫn cap 200.
> - `findAllGifts` nhận diện "quà tặng" bằng `description contains 'Tặng'` (string-matching tiếng
>   Việt có dấu) → rất giòn (đổi text mô tả là vỡ). Nên có `type`/`subtype` riêng cho gift.
> - `deletePayment` xoá CreditTransaction theo `referenceId=id` (= `payment.id`, là cuid của hàng Payment).
>   Nhưng với Stripe, `referenceId` của CreditTransaction nay = **`session.id`** (Checkout Session id,
>   KHÔNG phải `payment.id`) → xoá Payment Stripe sẽ KHÔNG xoá CreditTransaction tương ứng (mồ côi).
>   Với VietQR thì `referenceId = payment.id` (đặt trong `processPayment`) nên đúng. Cần thống nhất referenceId.
> - `deletePayment`/`donatePulse` ném `new Error(...)` thuần (không phải Http exception) →
>   trả 500 thay vì 4xx hợp lý.
> - Xoá Payment KHÔNG hoàn lại Pulse đã cộng cho user → mất cân đối số dư vs sổ cái.

---

## 7. UPLOAD (R2 / S3 / UploadThing)

**File**: `be/src/upload/*`. Xem thêm `be/src/upload/README.md`.

### 7.1 Provider thực tế đang dùng
- **Audio** → Cloudflare R2 (S3-compatible) qua `@aws-sdk/client-s3` (`AudioUploadService`).
- **Ảnh** → **Cloudflare R2** (`ImageUploadService`, folder `images/uploads`). (Trước dùng
  UploadThing; đã chuyển sang R2 — KHÔNG cần `UPLOADTHING_TOKEN` cho upload ảnh nữa.)
- **Xoá** (ảnh + audio) → `AudioUploadService.deleteByUrl(url)`: tách key từ `R2_URL`, gọi
  `DeleteObjectCommand`; bỏ qua an toàn nếu URL không thuộc R2 (vd URL UploadThing cũ).
- Env `STORAGE_PROVIDER` (r2/s3/uploadthing) ĐƯỢC khai báo nhưng code KHÔNG đọc để chọn
  provider động — cả audio lẫn ảnh đều hardcode R2.

### 7.2 Endpoints `/upload` (đều JwtAccessGuard + RolesGuard + @Roles('ADMIN'))
| Method | Route | Giới hạn | Loại file | Service |
|---|---|---|---|---|
| POST | `/upload/audio` | ≤ 100 MB | mime `audio/*` | `AudioUploadService.uploadAudio` → R2 |
| POST | `/upload/image` | ≤ 10 MB | jpeg/jpg/png/gif/webp/svg | `ImageUploadService.uploadImage` → **R2** (`images/uploads`) |
| POST | `/upload/delete` | body `{ url }` | — | `AudioUploadService.deleteByUrl` → xoá object R2 (ảnh+audio) |

- `/upload/audio` nhận thêm `@Body('folder')` ∈ `chapters|bgm|music` (mặc định `chapters`);
  folder khác → 400. Map sang prefix R2 (`audio/chapters`, `audio/bgm`, `audio/music`).
  Có thêm `music-thumbnails → images/music` dùng nội bộ (`uploadMusicThumbnail`, không qua controller).
- R2 key: `{folderPath}/{Date.now()}-{uuid}.{ext}`; URL trả = `R2_URL` + `/` + key.
- R2 config bắt buộc đủ: `endpoint, accessKeyId, secretAccessKey, bucketName, url` (thiếu → 400 lúc
  khởi tạo service). ⚠ Constructor ném lỗi nếu thiếu cấu hình → app vẫn boot nhưng provider lỗi
  khi DI khởi tạo (cẩn thận môi trường thiếu env R2).

> ⚠ **CẠM BẪY upload**:
> - Tên bucket R2 KHÔNG được chứa dấu gạch dưới `_`; code có bắt lỗi `InvalidBucketName` và trả
>   thông báo hướng dẫn đổi tên (`audio-upload.service.ts:104-111`).
> - Ảnh dùng UploadThing nhưng audio dùng R2 → 2 nhà cung cấp, 2 token/khoá khác nhau, 2 domain
>   ảnh/audio khác nhau. Khi refactor về 1 provider, sửa `ImageUploadService`.
> - `getExtension` của image-upload tính `extension` nhưng KHÔNG dùng (chỉ dùng `fileName =
>   Date.now()-originalname`). Code thừa.
> - Upload dùng `FileInterceptor` mặc định (memory storage) → file 100MB nằm hết trong RAM;
>   `diskStorage`/`mkdirSync` import trong controller nhưng KHÔNG dùng (code thừa).

---

## 8. MAIL / SMTP

**File**: `be/src/mail/*`.

- `MailModule` tạo provider `'MAIL_TRANSPORT'` = `nodemailer.createTransport` từ env
  `SMTP_HOST/PORT/SECURE/USER/PASS` (`mail.module.ts`). Mặc định port 587, `secure` khi
  `SMTP_SECURE==='true'`.
- `MailService.from` = `"NetViet Audio <SMTP_FROM>"`.
- Các hàm gửi (tất cả HTML inline):
  - `sendVerifyEmail`, `sendResetPassword`, `sendResetPasswordCode`, `sendVerificationCode` (auth).
  - `sendMembershipExpiryReminder(to, hoursLeft, endDate)` — dùng bởi cron membership.
  - `sendPaymentSuccessEmail(to, amount, pulseAmount, transactionId, paymentMethod)` —
    gọi sau khi nạp thành công (Stripe & VietQR). Format tiền VND, có nút về `cfg.cors.frontendUrl`.
  - `sendCollaborationInvite`, `sendInviteSentConfirmation`, `sendMergeRequestNotification` (collab).
  - `sendStoryUpdateEmail` (báo chương mới).
- Hầu hết hàm collab/payment **nuốt lỗi** (try/catch + log) → gửi mail thất bại KHÔNG làm hỏng
  giao dịch (tốt cho UX, nhưng phải theo dõi log để biết mail rớt).

> ⚠ Local dev: env trỏ `SMTP_HOST=127.0.0.1:1025` (Mailpit/Mailhog). Production phải đổi.
> Một số subject membership reminder viết KHÔNG DẤU (`'Goi hoi vien sap het han...'`) — không
> đồng nhất với các mail có dấu khác.

---

## 9. BẢNG BIẾN MÔI TRƯỜNG (.env)

Nguồn: `be/.env.example` + schema validate `be/src/shared/config/app-config.schema.ts` (Zod).
App **fail-fast**: thiếu biến bắt buộc → crash lúc boot. Alias bị bỏ (deprecated):
`MAIL_FROM`, `VIETQR_DEFAULT_TEMPLATE`, `VIETQR_ACQ_ID`, `R2_SECRET_KEY_ID` → dùng nếu set sẽ lỗi.

### 9.1 Runtime / hạ tầng
| Biến | Bắt buộc | Mặc định | Ghi chú |
|---|---|---|---|
| `APP_ROLE` | ✅ | `api` | `api|worker|scheduler` |
| `NODE_ENV` | ✅ | `development` | `development|test|staging|production` |
| `HOST` / `PORT` | – | `0.0.0.0` / `3000` | |
| `THROTTLE_DISABLED` | – | `false` | tắt rate-limit |
| `INTERNAL_API_KEY` | ✅ | – | ≥ 16 ký tự |
| `DATABASE_URL` | ✅ | – | MySQL/Prisma |
| `REDIS_URL` | ✅ | – | BullMQ/cache |
| `REDIS_HOST/PORT/PASSWORD/DB` | – | – | tuỳ chọn bổ sung |

### 9.2 CORS / cookie / auth
| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `WEB_ORIGIN`, `ADMIN_ORIGIN` | ✅ | origin FE/admin |
| `FRONTEND_URL`, `CLIENT_URL`, `ALLOWED_CLIENT_URLS`, `CORS` | – | redirect/CORS phụ; `FRONTEND_URL` còn dùng làm base success/cancel Stripe |
| `COOKIE_DOMAIN` | – | để trống ở localhost |
| `COOKIE_SAME_SITE` | – (`lax`) | `lax|strict|none` |
| `COOKIE_SECURE` | – (`false`) | |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✅ | ≥ 32 ký tự |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | – (`7d`/`30d`) | |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ✅ | seed admin |

### 9.3 Mail
| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `SMTP_HOST` | ✅ | |
| `SMTP_PORT` | ✅ | số nguyên dương |
| `SMTP_SECURE` | – (`false`) | |
| `SMTP_USER` / `SMTP_PASS` | – | có thể trống (local) |
| `SMTP_FROM` | ✅ | địa chỉ gửi |

### 9.4 OAuth (Google)
| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | – | tuỳ chọn, đăng nhập Google |

### 9.5 Storage / upload
| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `STORAGE_PROVIDER` | – (`r2`) | `r2|s3|uploadthing` — KHÔNG thực sự dùng để chọn provider |
| `UPLOADTHING_TOKEN` | – | bắt buộc DE FACTO để upload ẢNH (thiếu → 400) |
| `R2_TOKEN`, `R2_ACCOUNT_ID` | – | metadata R2 |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_URL`, `R2_ENDPOINT` | – | bắt buộc DE FACTO để upload AUDIO (thiếu → service ném lỗi). Bucket không chứa `_` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET_NAME` | – | S3 fallback (không thấy code dùng trong vùng này) |

### 9.6 Stripe
| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `STRIPE_SECRET_KEY` | – | thiếu → Stripe tắt (ném lỗi khi gọi) |
| `STRIPE_WEBHOOK_SECRET` | – | bắt buộc để verify webhook |
| `USD_TO_VND_RATE` | – (`25000`) | quy đổi VND→USD cho checkout |

### 9.7 VietQR
| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `VIETQR_API_URL` | – | (khai báo, chưa dùng — code dùng `img.vietqr.io` trực tiếp) |
| `VIETQR_CLIENT_ID` / `VIETQR_API_KEY` | – | (khai báo, chưa dùng) |
| `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME`, `VIETQR_BANK_ID` | – | bắt buộc DE FACTO (thiếu → "VietQR not configured") |
| `VIETQR_TEMPLATE` | – (`compact2`) | template ảnh QR |
| `VIETQR_QR_FORMAT` | – | (khai báo, chưa dùng) |
| `VIETQR_EXCHANGE_RATE` | – (`25000`) | (khai báo, chưa dùng trong vùng này) |
| `VIETQR_ORDER_EXPIRY_MINUTES` | – | ⚠ parse vào config nhưng KHÔNG nơi nào dùng (đơn hardcode 30') |

### 9.8 Casso
| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `CASSO_API_URL` | – | (khai báo, chưa dùng) |
| `CASSO_API_KEY` | – | (khai báo, chưa dùng) |
| `CASSO_SECURE_TOKEN` | ✅ DE FACTO | secret HMAC verify webhook; thiếu → webhook trả lỗi config |
| `CASSO_WEBHOOK_URL` | – | URL đăng ký bên Casso (tham khảo) |

### 9.9 Test helpers
`E2E_CLEANUP`, `TEST_STORY_SLUG`, `TEST_USER_TOKEN`, `TEST_ADMIN_TOKEN` — chỉ cho test cục bộ.

---

## 10. TÌNH TRẠNG & VIỆC CẦN LÀM (tổng hợp)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Stripe checkout + webhook | DONE | ✅ đã fix double-credit (`session.id` + P2002); đã set `provider` |
| Stripe verify-payment | DONE (dự phòng) | dùng chung idempotency key `session.id` với webhook → an toàn |
| VietQR tạo đơn + QR | PARTIAL | chỉ ảnh QR; `qr_emv`/`qr_data`=null; chưa dùng VietQR API key |
| Casso webhook + cộng Pulse | DONE (bảo mật khá) | ✅ timing-safe; CÒN: verify đa-format, không chống replay, log payload |
| Cron huỷ đơn VietQR quá hạn | **MISSING** | không có job; env expiry không dùng |
| Coin packages CRUD | DONE (giòn) | lưu JSON 1 row, race, mojibake description |
| Membership: admin đọc/xoá + cron nhắc | DONE | |
| Membership: luồng MUA (user) | **MISSING** | không có `membership.create` ở đâu |
| VIP set tier/expiry | NOT IN THIS AREA | không thấy trong billing — cần kiểm module user/admin |
| Credit transactions (my/donate/admin) | DONE (giòn) | phân trang RAM cap 200; gift match theo text; xoá payment không hoàn Pulse |
| Upload audio (R2) | DONE | |
| Upload ảnh (R2) | DONE | cùng R2 với audio; xoá qua `POST /upload/delete` |
| Mail/SMTP | DONE | nuốt lỗi gửi; local Mailpit |

### Ưu tiên refactor (cập nhật 2026-06-29)
1. **Thêm cron huỷ đơn VietQR quá hạn** (dùng `VIETQR_ORDER_EXPIRY_MINUTES`), và lọc `expiresAt`
   trong `processPayment` để từ chối tiền về quá hạn (hoặc xử lý hoàn/giữ rõ ràng). VẪN THIẾU.
2. ✅ ~~Gộp/khoá đường cộng Pulse Stripe~~ — ĐÃ XONG (dùng `session.id` + `create`/`P2002`). Giữ nguyên.
3. ✅ ~~Set `provider` khi tạo Payment Stripe~~ — ĐÃ XONG. (VietQR vẫn dựa default; nên set tường minh.)
4. **Siết verify Casso (còn lại)**: chốt 1 format chuẩn + kiểm timestamp (chống replay) + bỏ log payload.
   (timing-safe đã xong.)
5. **Hoàn thiện luồng mua Membership/VIP** (hiện thiếu hẳn) hoặc gỡ module nếu không dùng.
6. **Chuyển packages sang bảng riêng** (hết race + index + sửa mojibake `'Danh sÃ¡ch...'` ở `packages.service.ts:96`).
7. **Thống nhất `referenceId` CreditTransaction Stripe** (đang là `session.id`) ↔ `deletePayment`
   (xoá theo `payment.id`) để không để CreditTransaction mồ côi khi xoá Payment Stripe.
