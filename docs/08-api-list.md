# 08 · Danh sách API Backend

> Trích trực tiếp từ `be/src/**/*.controller.ts` (cập nhật 2026-07-08). ~180 endpoint.
> **KHÔNG có global prefix `/api`** — route ghi sao là thật vậy (vd `/stories`, `/music`, `/auth/login`).
> Base local: `http://localhost:3000`. Swagger (dev): `http://localhost:3000/docs`.
> Mỗi response bọc `{ data, meta }`; list endpoint (explore/music) bọc 2 lớp `{ data: { data, meta } }` → FE unwrap qua `lib/api/unwrap.ts`.

## Hệ thống
- `GET /` — app root (dummy)
- `GET /healthz` — liveness · `GET /readyz` — readiness (DB + Redis)

## Auth — `auth/auth.controller.ts` (`/auth`)
- `GET /auth/google` · `GET /auth/google-redirect` — Google OAuth
- `GET /auth/me` · `PATCH /auth/me`
- `POST /auth/refresh` · `POST /auth/logout`
- `POST /auth/register` · `POST /auth/login`
- `GET /auth/verify-email` · `POST /auth/verify-email` · `POST /auth/resend-verify`
- `POST /auth/verify-code` · `POST /auth/resend-code`
- `POST /auth/forgot-password` · `POST /auth/reset-password`
- `POST /auth/check-premium` *(đã thêm JwtAccessGuard)*
- `GET /auth/search-users` · `GET /auth/users` · `GET /auth/users/:id` · `PATCH /auth/users/:id/pulse` · `GET /auth/admin/stats` *(ADMIN)*

## Stories — `stories/stories.controller.ts` (`/stories`)
- `POST /stories` · `GET /stories` · `GET /stories/admin` · `GET /stories/admin/:id` · `GET /stories/home`
- `GET /stories/categories` · `GET /stories/categories-with-count` · `GET /stories/categories/top` · `GET /stories/authors`
- `GET /stories/explore` · `GET /stories/trending` · `GET /stories/recommended` · `GET /stories/hall-of-fame`
- `PATCH /stories/:id/recommended` · `PATCH /stories/:id` · `DELETE /stories/:id`
- `POST /stories/:id/gift` · `POST /stories/:id/unlock`
- `GET /stories/:slug` — chi tiết truyện (kèm chapters list, KHÔNG kèm content chương)

## Chapters — `chapters/chapters.controller.ts` (KHÔNG prefix, path tuyệt đối)
- `GET /stories/:storyId/chapters` · `POST /stories/:storyId/chapters`
- `POST /chapters` · `GET /chapters` · `GET /chapters/latest`
  - `POST /chapters`, `POST /stories/:storyId/chapters` và `PATCH /chapters/:id` nhận thêm 2 field optional
    (read-along, Spec 2): `timingRaw` (string, timing file gốc dạng text) + `timingFormat`
    (`'srt'|'vtt'|'lrc'|'auto'`, mặc định `'auto'`) — BE tự parse + match với `content` rồi lưu vào
    `Chapter.timingJson`, KHÔNG lưu 2 field này thành cột riêng.
- `GET /chapters/:id/public` — nội dung chương (content) cho người đọc
  - Response có thêm field `timing`: object `{ v, cues, matched, total }` hoặc `null` nếu chương chưa có
    timing. Mỗi cue trong `cues` có shape `{ s, e, p, cs, ce }` (s/e = startMs/endMs, p = index đoạn văn,
    cs/ce = char offset bắt đầu/kết thúc trong đoạn văn đó).
- `GET /chapters/:id/unlock-status` · `GET /chapters/:id/audio` — proxy audio (302 sau check entitlement)
- `POST /chapters/:id/unlock-by-ad` · `POST /chapters/:id/unlock-by-pulse`
- `GET /chapters/:id` · `PATCH /chapters/:id` · `DELETE /chapters/:id`

## Chapter variants (truyện tương tác) — `chapters/chapter-variants`
- `GET /chapters/:chapterId/variants` · `GET /chapter-variants/:id`
- `POST /chapter-variants` · `PATCH /chapter-variants/:id` · `DELETE /chapter-variants/:id`
- `POST /chapter-variants/:id/unlock` · `GET /chapters/:chapterId/unlocked-variants`

## Reviews — `reviews/reviews.controller.ts` (prefix `stories/:storyId`)
- `GET /stories/:storyId/rating-stats`
- `GET /stories/:storyId/reviews` · `POST /stories/:storyId/reviews`
- `POST /stories/:storyId/reviews/:reviewId/like` · `POST /stories/:storyId/reviews/:reviewId/helpful`
- `GET /stories/:storyId/reviews/:reviewId/replies` · `POST /stories/:storyId/reviews/:reviewId/replies`

## Chapter comments — `chapter-comments`
- `GET /chapters/:chapterId/comments/counts` · `GET /chapters/:chapterId/comments` · `POST /chapters/:chapterId/comments`
- `GET /comments/:commentId/replies` · `POST /comments/:commentId/reactions` · `POST /comments/:commentId/report`
- `GET /comments/reports` · `GET /comments/reports/stats` · `PATCH /comments/reports/:reportId`

## Comments (story-level, admin) — `comments` (`/comments`)
- `GET /comments` · `GET /comments/stats` · `PATCH /comments/:id` · `DELETE /comments/:id`

## Music — `music/`
**Tracks** (`/music`):
- `GET /music` · `GET /music/admin` · `GET /music/:slug` · `GET /music/:slug/related`
- `POST /music` · `PATCH /music/:id` · `DELETE /music/:id` · `POST /music/:id/play`

**Interactions** (`/music/interactions`):
- `GET /music/interactions/:musicId/liked` · `POST|DELETE /music/interactions/:musicId/like`
- `POST /music/interactions/:musicId/history` · `PATCH /music/interactions/:musicId/history`
- `GET /music/interactions/:musicId/access` · `POST /music/interactions/:musicId/unlock`
- `GET /music/interactions/history` · `GET /music/interactions/unlocked`
- `DELETE /music/interactions/history/:id` · `DELETE /music/interactions/history` · `GET /music/interactions/favorites`

**Comments** (`/music`):
- `GET /music/:musicId/comments` · `POST /music/:musicId/comments`
- `POST /music/comments/:commentId/reply` · `POST|DELETE /music/comments/:commentId/like`
- `PATCH /music/comments/:commentId` · `DELETE /music/comments/:commentId`

## Personal playlists — `personal-playlist` (`/personal-playlists`)
- `POST /personal-playlists` · `GET /personal-playlists` · `GET /personal-playlists/:id` · `PATCH /personal-playlists/:id`
- `POST /personal-playlists/:id/tracks/:musicId` · `DELETE /personal-playlists/:id/tracks/:musicId` · `DELETE /personal-playlists/:id`

## User features — `user-features` (KHÔNG prefix)
- `POST /favorites/toggle` · `GET /favorites`
- `GET /story-subscriptions/:storyId/status` · `POST /story-subscriptions/:storyId/toggle`
- `POST /history/sync` · `GET /history` · `DELETE /history/:id` · `DELETE /history`
- `GET /unlocked-stories`

## Billing / Thanh toán — `billing/controllers`
- `POST /billing/create-checkout-session` · `GET /billing/verify-payment` *(Stripe)*
- `POST /billing/vietqr/create-order` · `POST /billing/vietqr/order` · `GET /billing/vietqr/order/:orderId/status`
- `POST /billing/webhook/stripe` · `POST /billing/webhook/casso`

## Coin & VIP
- **Packages** (`/packages`): `GET` · `POST` · `PATCH /packages/:code` · `DELETE /packages/:code`
- **Memberships** (`/memberships`): `GET` · `GET /memberships/stats` · `DELETE /memberships/:id`
- **Transactions** (`/transactions`): `GET /transactions/my` · `POST /transactions/donate` · `GET /transactions/gifts` · `GET /transactions/payments` · `GET /transactions/stats` · `DELETE /transactions/payments/:id`

## Danh mục & phụ trợ
- **Categories** (`/categories`): `GET` · `GET /:id` · `POST` · `PATCH /:id` · `DELETE /:id` · `DELETE /categories/bulk/delete`
- **Labels** (`/labels`): `GET` · `GET /:id` · `POST` *(ADMIN)* · `PATCH /:id` *(ADMIN)* · `DELETE /:id` *(ADMIN)* · `DELETE /labels/bulk/delete` *(ADMIN)* — badge gắn trên cover truyện (mirror Categories, list KHÔNG cache); `POST /stories` và `PATCH /stories/:id` nhận thêm `labelId?: number|null` + `labelDurationDaysOverride?: number` để gắn/ghim label cho truyện.
- **Authors** (`/authors`): `GET` · `GET /:id` · `POST` · `PATCH /:id` · `DELETE /:id`
- **Languages** (`/languages`): `GET` · `GET /:id` · `POST` · `PATCH /:id` · `DELETE /:id`
- **Notifications** (`/notifications`): `GET` · `PATCH /notifications/:id/read` · `PATCH /notifications/read-all`
- **Banners** (`/banners`): `GET` · `GET /banners/admin` · `GET /banners/admin/:id` · `POST` · `PATCH /:id` · `DELETE /:id`
- **Ads** (`/ads`): `GET /ads/active` · `GET /ads` · `GET /ads/partners` · `GET /ads/:id` · `POST` · `POST /ads/:id/click` · `PATCH /:id` · `DELETE /:id`
- **Social links** (`/social-links`): `POST` · `GET` · `GET /social-links/admin/all` · `GET /:id` · `PATCH /:id` · `DELETE /:id`
- **Upload** (`/upload`): `POST /upload/audio` · `POST /upload/image`
- **Settings** (`/settings`): `GET` · `GET /settings/site` · `GET /settings/:key` · `POST` · `PATCH /settings/site` · `PATCH /settings/bulk` · `PATCH /settings/:key` · `PATCH /settings/site/:key` · `DELETE /settings/:key`
- **Stats** (`/stats`, tất cả ADMIN): `GET /stats/overview` · `GET /stats/vip-chapters`
  - `GET /stats/top-stories?metric=&limit=&language=` — top truyện theo metric global; `metric` ∈ `reads|rating|comments|favorites|gifts|trending|revenue|audio|search`, `limit` 1-100 (default 100), `language` optional.
  - `GET /stats/top-countries?metric=&limit=` — top quốc gia theo metric; `metric` ∈ `view|search|favorite|comment|rating|gift|revenue|listen|trending`, `limit` 1-100 (default 20).
  - `GET /stats/top-stories-by-country?country=XX&metric=&limit=` — top truyện trong 1 quốc gia; `metric` cùng enum trên, `country` CHAR(2), `limit` 1-100 (default 100).
  - `GET /stats/story-top-countries?storyId=&metric=&limit=` — top quốc gia của 1 truyện; `metric` cùng enum trên (default `view`), `limit` 1-100 (default 5). (`trending` = decay 30 ngày trên kind='view'; các kind khác = SUM(count).)
- **Tracking** (`/tracking`): `POST /tracking/view` · `POST /tracking/listen` · `POST /tracking/search-open {storyId (slug hoặc uuid), deviceId}` — ghi nhận mở truyện từ kết quả tìm kiếm, dùng để gộp geo-search.

---

## Luồng công khai (FE người dùng hay gọi)
- Trang chủ/khám phá: `GET /stories/explore`, `/stories/categories(/top)`, `/stories/authors`, `/stories/hall-of-fame`, `/banners`, `/chapters/latest`
- Chi tiết truyện: `GET /stories/:slug` → đọc chương: `GET /chapters/:id/public` → audio: `GET /chapters/:id/audio`
- Nhạc: `GET /music`, `GET /music/:slug`, `POST /music/:id/play`
- Cá nhân (cần JWT): `/favorites`, `/history`, `/unlocked-stories`, `/music/interactions/*`, `/transactions/my`

## Ghi chú
- Phân quyền: `@Roles(...)`/`@Permissions(...)` (xem `docs/02-be-auth-users.md`). Nhiều route admin nằm ở
  `*/admin`, `PATCH/POST/DELETE` create/update/delete.
- Cách trích lại danh sách: `rg "@Controller\(|@(Get|Post|Patch|Put|Delete)\(" be/src --type ts -g "*.controller.ts"`.
