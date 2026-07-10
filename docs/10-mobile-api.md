# 10 — Hợp đồng API cho Mobile (NovelVerse Flutter)

> MỤC ĐÍCH: tài liệu **hợp đồng kết nối** giữa app mobile Flutter
> (`../../novelverse`, thư mục `lib/api/`) và backend NestJS này. Gom mọi thứ cần để
> "kết nối dễ": base URL theo môi trường, quy ước envelope, auth, và danh sách
> endpoint mobile dùng. Dựa trên **đọc code thật**. Cập nhật: 2026-07-08.
>
> Danh sách đầy đủ ~180 endpoint: xem [08-api-list.md](08-api-list.md). File này là
> **tập con + quy tắc kết nối** cho client mobile, ánh xạ 1-1 với
> `novelverse/lib/api/api_endpoints.dart`.

═══════════════════════════════════════════════════════════════════════
## 1. BASE URL & MÔI TRƯỜNG
═══════════════════════════════════════════════════════════════════════

- **KHÔNG có prefix `/api`** — route trong code là route thật (`/stories`, `/music`,
  `/auth/login`). Đừng thêm `/api` ở client hay reverse proxy.
- Cổng mặc định BE: **3000** (dev). PM2 prod: `auth-be` (port 8035 sau reverse proxy).

| Môi trường | Base URL | Ghi chú |
|---|---|---|
| Dev — máy host / iOS sim / desktop | `http://localhost:3000` | |
| Dev — **Android emulator** | `http://10.0.2.2:3000` | `localhost` của emulator ≠ máy host |
| Dev — thiết bị thật cùng LAN | `http://<ip-LAN-máy-chạy-BE>:3000` | |
| **Production (VPS)** | `https://<domain-hoặc-ip-VPS>` | điền khi BE tách ra VPS |

> Phía mobile cấu hình ở `novelverse/lib/api/api_env.dart` (hoặc `--dart-define=
> API_BASE_URL=...`). Khi BE lên VPS chỉ cần đổi `prodBaseUrl` + chạy `--dart-define=
> API_ENV=prod`.

**CORS**: app Flutter **native** dùng Dio → KHÔNG bị ràng buộc CORS của trình duyệt
(không gửi `Origin`), nên gọi BE trực tiếp được. CORS chỉ ảnh hưởng **web build**;
nếu chạy Flutter Web, thêm origin vào `WEB_ORIGIN`/`ALLOWED_CLIENT_URLS` của BE
(xem `bootstrap.ts` → `collectAllowedOrigins`).

═══════════════════════════════════════════════════════════════════════
## 2. ENVELOPE RESPONSE (BẮT BUỘC HIỂU)
═══════════════════════════════════════════════════════════════════════

Mọi response thành công bị bọc bởi `ApiResponseInterceptor`:

```jsonc
{ "data": <payload>, "meta": { "requestId": "..." } }
```

Endpoint **list** thường bọc 2 lớp (payload lại là `{ data:[...], meta:{ total,page,lastPage } }`):

```jsonc
{ "data": { "data": [ ... ], "meta": { "total": 180, "page": 1, "lastPage": 9 } }, "meta": {...} }
```

Lỗi:

```jsonc
{ "error": { "code": "UNAUTHORIZED", "message": "...", "details": {} }, "meta": {...} }
```

→ Client **phải tự bóc `data`**. Phía mobile: `ApiClient` bóc 1 lớp; `unwrapList` bóc
tiếp lớp lồng (xem `lib/api/api_client.dart`). Bind lỗi theo `error.code`.

═══════════════════════════════════════════════════════════════════════
## 3. XÁC THỰC (AUTH)
═══════════════════════════════════════════════════════════════════════

- **Access token** (JWT, TTL ~15m): gửi header `Authorization: Bearer <access>`.
  Nhận trong body khi login/verify (`{ ok, access_token }`).
- **Refresh token** (TTL ~30d): web dùng cookie HttpOnly; **mobile** gửi qua header
  `x-refresh-token` khi gọi `POST /auth/refresh` (strategy đọc cả header lẫn cookie).
- Lưu phía mobile: access ở RAM/secure storage, refresh ở **flutter_secure_storage**
  (KeyStore/Keychain) — KHÔNG để shared_preferences.
- Một số endpoint nhạy cảm có **rate-limit** riêng (429 khi vượt): login, register,
  forgot/reset, verify-code, resend, change-password.

Luồng: `register → verify-code → {access}` · `login → {access}` · gọi API kèm Bearer ·
`401 → POST /auth/refresh (x-refresh-token) → {access mới}` · `logout → revoke`.

═══════════════════════════════════════════════════════════════════════
## 4. ENDPOINT MOBILE DÙNG (ánh xạ `lib/api/api_endpoints.dart`)
═══════════════════════════════════════════════════════════════════════

> `P` = public (không cần token), `A` = cần Bearer. Path là route thật (không `/api`).

### Auth
| Method | Path | | Body / ghi chú |
|---|---|---|---|
| POST | `/auth/register` | P | `{ email, password, name, redirect_uri? }` |
| POST | `/auth/login` | P | `{ email, password }` → `{ ok, access_token }` |
| POST | `/auth/verify-code` | P | `{ email, code }` → `{ access_token }` |
| POST | `/auth/refresh` | P* | header `x-refresh-token` → `{ ok, access_token }` |
| POST | `/auth/logout` | A | revoke refresh |
| GET | `/auth/me` | A | thông tin user (pulse, vip…) |
| POST | `/auth/forgot-password` | P | `{ email }` |
| POST | `/auth/reset-password` | P | `{ email, code, newPassword }` |
| POST | `/auth/change-password` | A | `{ currentPassword, newPassword }` |

### Stories / Chapters
| Method | Path | | Ghi chú |
|---|---|---|---|
| GET | `/stories/explore` | P | `?page&limit&lang&search&sort` → list 2 lớp + `meta{total,page,lastPage}` |
| GET | `/stories/home` | P | gói trang chủ (trending/newest/featured) |
| GET | `/stories/trending` | P | `?lang&trendWindow=today|week|month|all` |
| GET | `/stories/categories` | P | `?language` |
| GET | `/stories/:slug` | P | chi tiết truyện + chương (có `hlsUrl` nếu sẵn) |
| POST | `/stories/:id/unlock` | A | mở khoá cả truyện (trừ Pulse) |
| GET | `/chapters/:id/public` | P | nội dung chương công khai (+ `hlsUrl`, + `timing` cho read-along) |
| GET | `/chapters/:id/audio` | P/A | **302 redirect** tới audio thật (sau entitlement) |

### Music
| Method | Path | | Ghi chú |
|---|---|---|---|
| GET | `/music` | P | list (single/podcast/playlist) + `hlsUrl` |
| GET | `/music/:slug` | P | chi tiết track |
| GET | `/music/:slug/related` | P | track liên quan |
| POST | `/music/:id/play` | P/A | đếm lượt nghe |

### Billing / Khác
| Method | Path | | Ghi chú |
|---|---|---|---|
| GET | `/packages` | P | gói nạp Pulse (giá VND) |
| GET | `/memberships` | A | gói VIP / trạng thái |
| GET | `/banners` | P | banner hero |
| GET | `/notifications` | A | thông báo (chuông) |

### Tracking
| Method | Path | | Body / ghi chú |
|---|---|---|---|
| POST | `/tracking/search-open` | P | `{ storyId, deviceId }` — gọi khi user mở truyện từ kết quả tìm kiếm. `storyId` được gửi bằng slug (backend tự resolve sang id qua `OR:[{id},{slug}]`); dùng để đếm lượt mở theo quốc gia (geo attribution). |

═══════════════════════════════════════════════════════════════════════
## 5. QUY ƯỚC DỮ LIỆU (đồng bộ mobile)
═══════════════════════════════════════════════════════════════════════

- **Tiền ảo = "Pulse"** (`User.pulseBalance`), KHÔNG phải "coin". Mobile map `coin ↔ Pulse`.
  Cột DB còn tên cũ `credits` — đừng nhầm khi đọc raw DB (API đã trả `pulse*`).
- **Audio không lộ URL** trong JSON public → phát qua proxy `/chapters/:id/audio` (302)
  hoặc HLS `hlsUrl` (m3u8 + AES-128). Nội dung tính phí: key HLS cần token (hạn chế hiện tại).
- **Story.thumbnailUrl** = URL ảnh R2 (dùng `Image.network` ở mobile — đã hỗ trợ ở `CoverImage`).
- **`label` (badge bìa)**: các response trả truyện (`home`, `explore`, `:slug`, …) có field `label: { id, name, text, color, textColor, icon } | null` — thay cho badge tự tính (NEW/HOT/TOP/VIP) trước đây. App render badge trực tiếp từ `label.text` trên `label.color` (không tự suy luận nữa).
- **Enum trạng thái** là nguồn sự thật ở `be/prisma/schema.prisma` (xem [04-database.md](04-database.md)).
  `PaymentStatus` có cả `SUCCESS` lẫn `SUCCEEDED` — lọc "đã thanh toán" phải tính cả hai.
- **Tiền tệ là trọng tài ở BE**: mobile KHÔNG tự cộng/trừ Pulse rồi mới gọi API — gọi API,
  cập nhật theo phản hồi (chống double-credit, xem [05-integrations-webhooks.md](05-integrations-webhooks.md)).
- **`timing` (read-along)**: field mới trong `GET /chapters/:id/public`, optional —
  `{ v:1, cues:[{ s, e, p, cs, ce }], matched, total }` hoặc `null` nếu chương chưa có timing.
  `s`/`e` = mốc ms bắt đầu/kết thúc câu, `p` = index đoạn văn (-1 nếu không khớp được), `cs`/`ce`
  = vị trí ký tự bắt đầu/kết thúc trong đoạn văn gốc `p`. Mobile map trực tiếp từng cue sang
  `TimingCue` (đọc đúng khoá `s,e,p,cs,ce`) để highlight câu đang đọc; `v`/`matched`/`total` chỉ
  phục vụ admin, app bỏ qua.

═══════════════════════════════════════════════════════════════════════
## 6. SWAGGER & HEALTH
═══════════════════════════════════════════════════════════════════════

- **Swagger UI**: `GET /docs` · **OpenAPI JSON**: `GET /docs-json` (chỉ non-production).
  201 endpoint đã có `@ApiTags`/`@ApiOperation` → dùng để dò contract khi dev.
- **Health**: `GET /healthz` (liveness) · `GET /readyz` (DB + Redis).

> Khi BE thêm/đổi route → cập nhật file này VÀ `novelverse/lib/api/api_endpoints.dart`
> để 2 bên không lệch (theo memory: sau mỗi fix cập nhật doc).
