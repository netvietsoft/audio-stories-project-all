# 🔔 BE — Các module phụ trợ còn lại

> VÙNG NÀY: notifications (chuông + email, KHÔNG realtime), tracking (Redis + cron đếm
> view/listen), ads (quảng cáo đối tác — banner/iframe/youtube), banners (hero banner),
> settings (site config + system config), stats (dashboard admin), user-features
> (favorite/subscription/history/unlocked — GOD-SERVICE), social-links.
> Đọc code thật tại `be/src/{notifications,tracking,ads,banners,settings,stats,user-features,social-links}`.
> Cập nhật: 2026-06-27 (đọc code thật).

---

## 0. LƯU Ý CHUNG (đọc trước)

- **KHÔNG có global prefix `/api`.** `be/src/main.ts` chỉ gọi `bootstrap()`; bootstrap không
  `setGlobalPrefix` → route trong code chính là route thật (`@Controller('tracking')` → `POST /tracking/view`).
- **Auth:** `JwtAccessGuard` (`@/auth/guards/jwt-access.guard`) + `@Account()`. Mọi controller
  lặp lại helper `userIdFromAccount(account) = account?.id || account?.sub` (xem Lỗi cấu trúc).
- **Phân quyền admin:** `RolesGuard` + `@Roles('ADMIN')`. ⚠ **social-links dùng `@Roles('admin')`
  (chữ thường)** — không khớp với phần còn lại (xem Lỗi cấu trúc, mục 8).
- **PrismaModule là `@Global()`** → module không cần import vẫn dùng được Prisma.
- **Redis là tuỳ chọn cho từng module nhưng cách xử lý KHÁC NHAU:** `tracking` BẮT BUỘC có
  `REDIS_URL` (thiếu → API 503); `user-features` thiếu Redis thì **fallback ghi thẳng DB**.
- **Tiền tệ ảo = "Pulse"**; stats tính doanh thu từ `Payment.amountVnd` (status `SUCCESS`) và
  Pulse thực thu từ `user_chapter_unlocks`.

---

## 1. NOTIFICATIONS — chuông thông báo (DB) + email (gián tiếp)

### Mục đích
Lưu thông báo trong DB cho "chuông" trên FE. **KHÔNG có Socket.io / WebSocket** ở đây — dù tên
gợi ý realtime, thực tế chỉ là CRUD bảng `Notification` + đếm chưa đọc. Email được gửi ở nơi
khác (module này chỉ tạo bản ghi chuông, xem mục 7 user-features).

### File chính
- `be/src/notifications/notifications.controller.ts` — 3 route, đều `@UseGuards(JwtAccessGuard)`.
- `be/src/notifications/notifications.service.ts` — list/markRead + 2 factory tạo noti.
- `be/src/notifications/dto/list-notifications.dto.ts` — page/limit/unreadOnly.

### Endpoint + logic
| Method | Route | Logic |
|---|---|---|
| GET | `/notifications` | List của user hiện tại, `limit` cap 50. Trả `meta.unreadCount` (đếm riêng, KHÔNG phụ thuộc `unreadOnly`). |
| PATCH | `/notifications/:id/read` | Đánh dấu đã đọc 1 noti; check `userId` sở hữu, nếu đã đọc trả `{ ok:true }` luôn. |
| PATCH | `/notifications/read-all` | `updateMany` tất cả noti chưa đọc → trả `count`. |

### Factory tạo noti (gọi từ module khác)
- `createPaymentNotification(userId, amount, pulseAmount, transactionId, paymentMethod)` —
  type `transaction`, format tiền VND. Dùng khi nạp Pulse thành công.
- `createStoryUpdateNotification(userId, payload)` — type `new_chapter`, gọi từ
  `user-features.notifyStoryUpdated()` khi có chương mới / cập nhật chương.

### Tình trạng: **DONE** (cho phạm vi "bell").
### Phần còn thiếu
- KHÔNG realtime (không Socket.io/SSE/push). FE phải polling `GET /notifications`.
- Không có route admin gửi thông báo broadcast/thủ công.
- `body` của `createStoryUpdateNotification` viết **không dấu** ("Truyen ... co chuong moi"),
  lệch với `createPaymentNotification` (có dấu, có currency format) — không nhất quán UX.

---

## 2. TRACKING — đếm view/listen (Redis buffer + cron flush)

### Mục đích
Đếm lượt xem (`view`) và lượt nghe (`listen`) cho story + chapter **không ghi DB mỗi request**.
Cộng dồn vào Redis, chống spam bằng dedup theo device, rồi cron 5 phút flush vào DB.

### File chính
- `be/src/tracking/tracking.controller.ts` — 2 route POST, **KHÔNG có guard** (public).
- `be/src/tracking/tracking.service.ts` — Redis client riêng + cron `flushTrackingCounters`.
- `be/src/tracking/dto/track-event.dto.ts` — `storyId`/`chapterId` (UUID) + `deviceId` (8–128 ký tự).

### Endpoint
| Method | Route | Logic |
|---|---|---|
| POST | `/tracking/view` | `track('view', dto)` |
| POST | `/tracking/listen` | `track('listen', dto)` |

### Luồng đếm (`track`)
1. `ensureRedisEnabled()` — nếu không có `REDIS_URL` → **503 ServiceUnavailable** (BẮT BUỘC Redis).
2. Dedup key `track:{kind}:{storyId}:{chapterId}:{deviceId}` set NX, TTL **3600s (1h)**. Trùng → bỏ qua, trả `{ counted:false, deduplicated:true }`.
3. Lần đầu: `INCR story:views:{storyId}` + `INCR chapter:views:{chapterId}` (atomic MULTI).

⚠ **Dedup gộp chung view và listen vào cùng namespace key chỉ khác `{kind}`** — đúng vì có `kind`
trong key. NHƯNG **counter Redis dùng CHUNG `story:views:`/`chapter:views:` cho cả view lẫn listen**
→ DB chỉ có 1 cột `totalViews`/`viewCount`, listen và view bị cộng dồn chung, **không tách được
số lượt nghe** (xem Lỗi/Phần còn thiếu).

### Cron `flushTrackingCounters` — `EVERY_5_MINUTES`
- SCAN key theo prefix → với mỗi key: `RENAME key -> key:processing:{ts}:{rand}` (atomic swap để
  INCR mới không mất), đọc count, build `story.updateMany {totalViews:{increment}}` /
  `chapter.updateMany {viewCount:{increment}}`.
- Ghi DB trong **1 `$transaction`**. Lỗi DB → khôi phục counter về key gốc (`INCRBY`), rồi throw.
- Thành công → `DEL` các processing key. Toàn bộ bọc try/catch, **không throw ra ngoài** để cron
  không làm sập app.

### Tình trạng: **DONE** (logic flush an toàn, có rollback).
### Phần còn thiếu / LỖI
- **Không phân biệt view vs listen ở DB.** Cả 2 cùng tăng `totalViews`/`viewCount`. Nếu cần thống
  kê "lượt nghe" riêng → phải thêm counter key + cột DB riêng.
- Cron chạy **trong mọi instance** (không có lock phân tán). Nhiều instance cùng SCAN — `RENAME`
  atomic giảm rủi ro double-count nhưng SCAN trùng vẫn tốn tài nguyên.
- `deviceId` do client tự gửi → spam vẫn được nếu client xoay deviceId.

---

## 3. ADS — quảng cáo đối tác (image / iframe / youtube)

### Mục đích
Quản lý quảng cáo hiển thị trên FE: ảnh, iframe HTML, hoặc video YouTube. **KHÔNG phải
"unlock-by-ad" (mở khoá bằng xem quảng cáo)** — logic mở khoá nằm ở chapters/credits; ở đây ad
chỉ là banner đối tác + đếm click. (Tham số mở khoá-bằng-ad nằm ở `settings`, mục 5.)

### File chính
- `be/src/ads/ads.controller.ts` — public `active`+`click`; còn lại `@Roles('ADMIN')`.
- `be/src/ads/ads.service.ts` — CRUD + `extractYoutubeId` (parse URL/iframe → 11 ký tự id) + `shuffle`.
- `be/src/ads/dto/*` — `create-ad`, `update-ad`, `active-ads-query` (`lang`, `routeType`, `limit`).

### Endpoint
| Method | Route | Quyền | Logic |
|---|---|---|---|
| GET | `/ads/active` | public | Ad đang `isActive`, lọc `isGlobal OR language.key=lang`, `routeType` nếu có; **shuffle ngẫu nhiên** rồi cắt theo `limit` (cap 20). |
| GET | `/ads` | ADMIN | List admin, filter title/partner/isActive/routeType/language, sort theo `clickCount`. |
| GET | `/ads/partners` | ADMIN | Danh sách `partnerName` distinct. |
| GET | `/ads/:id` | ADMIN | Chi tiết. |
| POST | `/ads` | ADMIN | Tạo. `contentType` mặc định `image`; iframe→clear imageUrl/targetUrl; youtube→`youtubePlayTime` mặc định 31s. |
| POST | `/ads/:id/click` | **public** | `clickCount +1`. |
| PATCH | `/ads/:id` | ADMIN | Update (xử lý chuyển contentType phức tạp — clear field không dùng). |
| DELETE | `/ads/:id` | ADMIN | Xoá cứng. |

### Tình trạng: **DONE**.
### Phần còn thiếu / LỖI
- `routeType` là **số nguyên không có enum/hằng tên** (mặc định 1) — ý nghĩa ("vị trí route nào")
  không định nghĩa ở BE, chỉ FE biết. Khó bảo trì.
- `POST /ads/:id/click` public + không dedup → click count **bơm được tuỳ ý** (không như tracking).
- `update()` query Prisma **2 lần liên tiếp** (`findUnique` check tồn tại, rồi `findUnique` lấy
  contentType) — gộp được thành 1.
- Logic clear field theo contentType trong `update()` rất rối, dễ sót case khi đổi loại.

---

## 4. BANNERS — hero banner (đa ngôn ngữ vi/en)

### Mục đích
Hero banner trang chủ, song ngữ (`titleVi`/`titleEn`, `subtitleVi`/`subtitleEn`), có thể trỏ tới
`targetUrl` hoặc 1 `story`.

### File chính
- `be/src/banners/banners.controller.ts` — `GET /banners` public; admin dưới `/banners/admin/*`.
- `be/src/banners/banners.service.ts` — `buildLocalizedPayload` (bắt buộc ≥1 title), fallback ngôn ngữ.

### Endpoint
| Method | Route | Quyền | Logic |
|---|---|---|---|
| GET | `/banners` | public | `isActive` (mặc định true), sort `order asc`. Trả thêm `title`/`subtitle` đã chọn theo `lang` (vi/en, có fallback chéo). |
| GET | `/banners/admin` | ADMIN | Tất cả (kèm story). |
| GET | `/banners/admin/:id` | ADMIN | Chi tiết. |
| POST | `/banners` | ADMIN | Tạo; `ensureStoryExists` nếu có `storyId`. |
| PATCH | `/banners/:id` | ADMIN | Update; merge title cũ/mới rồi validate lại ≥1 title. |
| DELETE | `/banners/:id` | ADMIN | Xoá cứng. |

### Tình trạng: **DONE**.
### Phần còn thiếu / LỖI
- ⚠ **Đụng route tiềm ẩn:** admin GET dùng `/banners/admin` và `/banners/admin/:id` (an toàn),
  nhưng `PATCH/DELETE /banners/:id` **không** có tiền tố admin trong khi `GET` admin thì có →
  bố cục route không nhất quán (dễ nhầm khi mở rộng).
- Không có cron/expiry; banner chỉ bật/tắt thủ công bằng `isActive`.

---

## 5. SETTINGS — site config (key-value) + system config

### Mục đích
2 kho cấu hình tách biệt trong DB:
- **`SiteSetting`** (`key`,`value`,`type`,`description`) — config tổng quát (social URL, custom head script…).
- **`SystemConfig`** (`key`,`value`) — config số cho cơ chế ad/unlock của FE.

### File chính
- `be/src/settings/settings.controller.ts` — định nghĩa `PUBLIC_KEYS` cho phép đọc public.
- `be/src/settings/settings.service.ts` — parse type (number/boolean/json), upsert hàng loạt.

### Endpoint
| Method | Route | Quyền | Logic |
|---|---|---|---|
| GET | `/settings` | ADMIN | Tất cả SiteSetting dạng object `{key:{value,type,description,updatedAt}}` (đã parse type). |
| GET | `/settings/site` | public | Chỉ trả whitelist: `facebook_url, twitter_url, instagram_url, youtube_url, reddit_url, whatsapp_url, custom_head_scripts`. |
| GET | `/settings/:key` | public | **Chỉ SystemConfig** và **chỉ khi key ∈ PUBLIC_KEYS** (`ad_insertion_frequency`, `unlock_ad_reappearance_minutes`, `unlock_ad_countdown_seconds`); ngược lại 404. |
| PATCH | `/settings/site` | ADMIN | Map key thân thiện (`facebookUrl`→`facebook_url`…) rồi `updateMultiple` (upsert). |
| POST | `/settings` | ADMIN | Tạo SiteSetting (409 nếu trùng key). |
| PATCH | `/settings/bulk` | ADMIN | Upsert nhiều SiteSetting; tự suy `type` theo typeof value. |
| PATCH | `/settings/:key` | ADMIN | **Update SystemConfig** (số) — `updateSystemConfigByKey`. |
| PATCH | `/settings/site/:key` | ADMIN | Update 1 SiteSetting. |
| DELETE | `/settings/:key` | ADMIN | Xoá SiteSetting. |

- Safety fallback: `getSystemConfigByKey('ad_insertion_frequency')` tự tạo bản ghi value `1000`
  nếu seed chưa chạy.

### Tình trạng: **DONE** (nhưng route design rối — xem dưới).
### Phần còn thiếu / LỖI cấu trúc (QUAN TRỌNG)
- ⚠ **`PATCH /settings/:key` thao tác SystemConfig, còn `PATCH /settings/site/:key` thao tác
  SiteSetting** — hai kho khác nhau dùng path gần giống nhau. `GET /settings/:key` lại chỉ đọc
  SystemConfig. **Rất dễ nhầm.** `:key` cụ thể như `bulk`/`site` được khai báo trước nên không bị
  nuốt, nhưng thứ tự khai báo route là điểm dễ vỡ khi thêm route mới.
- 2 model config (`SiteSetting` vs `SystemConfig`) trộn trong cùng controller, không tách rõ.
- `updateMultiple` không validate key tồn tại — gõ sai key sẽ âm thầm tạo setting rác.

---

## 6. STATS — dashboard admin

### Mục đích
Số liệu cho trang admin: tổng quan + thống kê chương VIP/timed (số lượt mở & Pulse thực thu).

### File chính
- `be/src/stats/stats.controller.ts` — 2 route, đều ADMIN.
- `be/src/stats/stats.service.ts` — `getOverviewStats`, `getVipChapterStats` (có `$queryRaw`).
- `be/src/stats/dto/vip-chapter-stats-query.dto.ts` — page/limit/search/accessType/sortBy/sortOrder (enum).

### Endpoint
| Method | Route | Logic |
|---|---|---|
| GET | `/stats/overview` | `totalUsers`, `totalStories`, `totalRevenue` = SUM(`Payment.amountVnd`) where status `SUCCESS`. |
| GET | `/stats/vip-chapters` | Story có chương `accessType ∈ {vip,timed}`; với mỗi chương đọc sổ cái `user_chapter_unlocks` (raw SQL GROUP BY chapter_id, unlock_type) đếm `vipOpenCount/timedOpenCount/pulseCount` và SUM `pulse_amount` (= `totalCredits` Pulse thực thu). Sort credits/opens, phân trang **trong bộ nhớ**. |

### Tình trạng: **DONE** (đủ cho dashboard hiện tại).
### Phần còn thiếu / LỖI
- `getVipChapterStats` **load TẤT CẢ story khớp where rồi mới slice trong RAM** → không phân trang
  ở DB, dữ liệu lớn sẽ chậm/ngốn RAM.
- Dùng `$queryRaw` bảng `user_chapter_unlocks` với cột snake_case (`unlock_type`, `pulse_amount`)
  → **coupling chặt với tên cột DB vật lý**, đổi schema là vỡ silently.
- Field `vipCredits`/`timedCredits` luôn = 0 ("kept for interface compat") — rác trong payload.
- Comment lẫn tiếng Thái (`ไม่ใช้แล้ว`) — di tích copy/paste.
- Chỉ 2 chỉ số tổng (`overview`) — thiếu thống kê theo thời gian, theo tác giả, churn…

---

## 7. USER-FEATURES — GOD-SERVICE (favorite / subscription / history / unlocked)

### Mục đích
Gom NHIỀU tính năng người dùng vào 1 service: yêu thích truyện, đăng ký theo dõi truyện (nhận
noti chương mới), lịch sử nghe (Redis buffer + cron flush), danh sách chương đã mở khoá, và
**điểm phát noti cho toàn hệ thống** (`notifyStoryUpdated`).

### File chính
- `be/src/user-features/user-features.controller.ts` — `@Controller()` **KHÔNG có prefix** →
  route ở gốc (`/favorites`, `/history`, `/unlocked-stories`, `/story-subscriptions/...`).
- `be/src/user-features/user-features.service.ts` — **~940 dòng GOD-SERVICE**, Redis client riêng + cron.
- DTO: `sync-history`, `history-query`, `toggle-favorite`.
- Module import `NotificationsModule`, `MailModule`, `StoriesModule` (`forwardRef` với Stories).

### Endpoint (đều `JwtAccessGuard`)
| Method | Route | Logic |
|---|---|---|
| POST | `/favorites/toggle` | Thêm/bỏ `UserFavorite`, đồng thời `story.favoritesCount ±1` + `storiesService.invalidateExploreCache()`. |
| GET | `/favorites` | Danh sách truyện yêu thích, filter/sort như explore. |
| GET | `/story-subscriptions/:storyId/status` | `{ isSubscribed }`. |
| POST | `/story-subscriptions/:storyId/toggle` | Bật/tắt `UserStorySubscription` (check story tồn tại + chưa xoá). |
| POST | `/history/sync` | Lưu tiến độ nghe (`progressSeconds`). Redis có → `HSET history:sync`; không → ghi thẳng DB (upsert theo variantId, xử lý riêng case variantId null). |
| GET | `/history` | Lịch sử nghe, **merge DB + pending Redis** (cả `history:sync` lẫn `history:sync:processing`), dedup theo chapterId, sort `lastListenedAt`, **phân trang trong RAM**. |
| GET | `/unlocked-stories` | Danh sách `UserUnlockedVariant` (chương VIP đã mở), kèm story/chapter/variant. |
| DELETE | `/history/:id` | Xoá 1 mục lịch sử (+ xoá field tương ứng trong Redis). |
| DELETE | `/history` | Xoá toàn bộ lịch sử user (+ xoá pending Redis). |

### `notifyStoryUpdated(storyId, chapterId, updateType)` — điểm phát noti
- Gọi từ `chapters.service.ts` khi tạo/cập nhật chương (`new_chapter` / `chapter_updated`).
- Lấy danh sách subscriber của story; với mỗi user:
  - `allowBellNoti` → `notificationsService.createStoryUpdateNotification(...)` (chuông DB).
  - `allowEmailNoti` → `mailService.sendStoryUpdateEmail(...)` (link `FRONTEND_URL/story/{slug}/chuong-{n}`).
- `Promise.all` toàn bộ subscriber **cùng lúc** — không batch/throttle.

### Cron `flushHistorySyncCache` — `EVERY_5_MINUTES`
- Lua script: nếu `history:sync` tồn tại và `history:sync:processing` chưa tồn tại →
  `RENAME` sang processing (atomic, tránh nuốt sync mới). Nếu processing đang bận → bỏ cycle.
- `HGETALL` processing → upsert `listeningHistory` theo `userId_chapterId_variantId` trong
  `$transaction`, rồi `DEL` processing. Bọc try/catch, không throw ra ngoài.

### Tình trạng: **DONE** về chức năng, nhưng **NỢ KỸ THUẬT NẶNG**.
### Phần còn thiếu / LỖI cấu trúc (QUAN TRỌNG — ưu tiên refactor)
1. **GOD-SERVICE ~940 dòng** gộp 5+ trách nhiệm (favorite, subscription, history, unlocked,
   notify) + tự quản Redis + cron. Nên tách: `FavoritesService`, `SubscriptionsService`,
   `ListeningHistoryService`, `StoryNotifyService`.
2. **Controller không prefix** → route nằm rải rác ở gốc (`/favorites`, `/history`…), khó nhìn ra
   chúng thuộc cùng module; dễ đụng route với module khác trong tương lai.
3. **Phân trang history trong RAM** (load hết DB + pending rồi `slice`) — không scale.
4. **Khởi tạo Redis lặp y hệt tracking** (cùng ~50 dòng retryStrategy/keepAlive) — nên tách 1
   `RedisService` dùng chung cho cả tracking + user-features.
5. `syncHistory` fallback DB có **2 nhánh code gần trùng nhau** (variantId null vs non-null) +
   catch P2002 thủ công — nên dùng 1 unique đầy đủ và upsert thống nhất.
6. `forwardRef(StoriesService)` → có **vòng phụ thuộc** UserFeatures ↔ Stories; cần gỡ khi refactor.
7. `notifyStoryUpdated` không idempotent: gọi 2 lần (vd retry) sẽ gửi noti/email trùng.

---

## 8. SOCIAL-LINKS — link mạng xã hội

### Mục đích
CRUD link MXH hiển thị ở footer (`platform` enum, `label`, `url`, `iconUrl`, `orderIndex`, `isActive`).

### File chính
- `be/src/social-links/social-links.controller.ts`, `social-links.service.ts`, DTO create/update.

### Endpoint
| Method | Route | Quyền | Logic |
|---|---|---|---|
| GET | `/social-links` | `@Public()` | Chỉ `isActive`, sort `orderIndex asc`. |
| GET | `/social-links/admin/all` | admin | Tất cả. |
| GET | `/social-links/:id` | `@Public()` | Chi tiết (không lọc isActive). |
| POST | `/social-links` | admin | Tạo. |
| PATCH | `/social-links/:id` | admin | Update. |
| DELETE | `/social-links/:id` | admin | Xoá cứng. |

### Tình trạng: **DONE** (CRUD cơ bản).
### Phần còn thiếu / LỖI (QUAN TRỌNG)
- ⚠ **`@Roles('admin')` chữ THƯỜNG** trong khi toàn bộ module khác dùng `@Roles('ADMIN')`. Nếu
  `RolesGuard` so sánh phân biệt hoa thường → **route admin của social-links sẽ luôn 403** (hoặc
  ngược lại, mở cho role không tồn tại). **Cần kiểm tra `RolesGuard` và đồng bộ.**
- `GET /social-links/:id` là `@Public()` và không lọc `isActive` → lộ link đang tắt nếu biết id.
- Import Prisma bằng đường dẫn tương đối `../prisma/...` (các module khác dùng alias `@/prisma`) —
  không nhất quán style.

---

## 9. BẢN ĐỒ NHANH — module nào dùng gì

| Module | Redis | Cron | Public route | Guard chính | God-service? |
|---|---|---|---|---|---|
| notifications | ✗ | ✗ | ✗ | JwtAccess | ✗ |
| tracking | ✅ bắt buộc | ✅ 5 phút | ✅ view/listen | (none) | ✗ |
| ads | ✗ | ✗ | ✅ active/click | Roles ADMIN | ✗ |
| banners | ✗ | ✗ | ✅ GET / | Roles ADMIN | ✗ |
| settings | ✗ | ✗ | ✅ site/PUBLIC_KEYS | Roles ADMIN | ✗ |
| stats | ✗ | ✗ | ✗ | Roles ADMIN | ✗ |
| user-features | ✅ fallback DB | ✅ 5 phút | ✗ | JwtAccess | ✅ ~940 dòng |
| social-links | ✗ | ✗ | ✅ GET | Roles **admin** ⚠ | ✗ |

### Cron toàn vùng (cùng tick `EVERY_5_MINUTES`)
- `TrackingService.flushTrackingCounters` — Redis view counter → DB.
- `UserFeaturesService.flushHistorySyncCache` — Redis history → DB.
- ⚠ Cả 2 cron chạy **mọi instance, không lock phân tán**.
