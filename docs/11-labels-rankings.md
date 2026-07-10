# 11 — Labels + Bảng xếp hạng (Story Rankings)

> Đọc CODE THẬT — cập nhật theo source ngày 2026-07-09. Ghi lại **cả 5 sub-project đã
> ship**: **A** (Story Labels), **B1** (bảng xếp hạng metric toàn cục), **B2a** (gán
> quốc gia ẩn danh cho view/search), **B2b** (gán quốc gia cho 6 hành động người
> dùng), **C** (menu admin Bảng xếp hạng + trending-per-country). Toàn bộ nằm trên
> `master`, **CHẠY LOCAL, CHƯA PUSH / CHƯA DEPLOY** (đúng theo memory dự án).
> Migration `.sql` bị gitignore (`*.sql`) → khi lên prod cần `prisma migrate deploy`
> (hoặc chạy tay) cho 3 migration mới liệt kê ở mục 0. **B2b + C KHÔNG thêm migration.**
>
> Thiết kế gốc (đầy đủ hơn, có rationale + alternatives cân nhắc):
> [`superpowers/specs/2026-07-09-story-labels-design.md`](superpowers/specs/2026-07-09-story-labels-design.md),
> [`2026-07-09-story-rankings-b1-global-design.md`](superpowers/specs/2026-07-09-story-rankings-b1-global-design.md),
> [`2026-07-09-story-rankings-b2a-geo-design.md`](superpowers/specs/2026-07-09-story-rankings-b2a-geo-design.md),
> [`2026-07-09-story-rankings-b2b-user-geo-design.md`](superpowers/specs/2026-07-09-story-rankings-b2b-user-geo-design.md),
> [`2026-07-09-story-rankings-c-admin-ui-design.md`](superpowers/specs/2026-07-09-story-rankings-c-admin-ui-design.md)
> (kế hoạch triển khai tương ứng nằm ở `superpowers/plans/` cùng ngày).

═══════════════════════════════════════════════════════════════════════
## 0. MÔ HÌNH DỮ LIỆU MỚI (nguồn sự thật: `be/prisma/schema.prisma`)
═══════════════════════════════════════════════════════════════════════

```
Label (id Int PK, name unique, text, color, textColor?, icon?,
       defaultDurationDays? [null/0 = không hết hạn], createdAt, updatedAt)
   └─ 1-n Story   (Story.labelId, onDelete SetNull)
-- GLOBAL, không theo ngôn ngữ. @@map("labels")

Story  (đã có, gắn thêm 3 cột)
   labelId         Int?      @map("label_id")           FK → labels, SetNull
   labelAssignedAt DateTime? @map("label_assigned_at")
   labelExpiresAt  DateTime? @map("label_expires_at")
   @@index([labelId])

StoryViewDaily (storyId, date [Date], views Int)
   @@id([storyId, date])  @@index([date])  @@map("story_view_daily")
-- 1 dòng / truyện / ngày (UTC) — nguồn cho trending + đối soát total_views.

StoryCountryDaily (storyId, country CHAR(2), date [Date], kind VARCHAR(10), count Int)
   @@id([storyId, country, date, kind])
   @@index([kind, country])  @@index([kind, storyId])
   @@map("story_country_daily")
-- 1 dòng / truyện / quốc gia / ngày / loại sự kiện — bảng breakdown theo quốc gia.
-- kind LƯU (8): 'view'|'search' (B2a) + 'favorite'|'comment'|'rating'|'gift'|'revenue'|'listen' (B2b).
-- 'trending' KHÔNG lưu — tính động từ kind='view' (decay 0.9, 30 ngày) khi query (C).
```

3 migration mới (đã apply local, **CHƯA CHẠY PROD**):

| Migration | Nội dung |
|---|---|
| `20260709103611_add_labels_and_story_label` | bảng `labels` + 3 cột `label_id`/`label_assigned_at`/`label_expires_at` trên `stories` |
| `20260709140000_add_story_view_daily` | bảng `story_view_daily` |
| `20260709160000_add_story_country_daily` | bảng `story_country_daily` |

═══════════════════════════════════════════════════════════════════════
## A. STORY LABELS — badge bìa truyện do admin quản lý
═══════════════════════════════════════════════════════════════════════

### A.1 Bối cảnh — thay thế badge suy diễn cũ

Trước đây có một hàm `computeBadge` suy ra badge NEW/HOT/TOP/VIP từ dữ liệu truyện
(ngày tạo, lượt xem…). Hàm này **đã bị xoá**. Badge giờ là dữ liệu thật do admin
gán tay qua model `Label`, KHÔNG còn suy diễn tự động.

### A.2 Module `be/src/labels/` (mirror module `categories`)

File: `labels.controller.ts` / `labels.service.ts` / `labels.module.ts` / `dto/`.

| Method | Route | Auth | Hàm |
|--------|-------|------|-----|
| GET | `/labels` | public | `findAll` (search name\|text, phân trang; **KHÔNG cache**, khác `categories`) |
| GET | `/labels/:id` | public | `findOne` |
| POST | `/labels` | ADMIN | `create` |
| PATCH | `/labels/:id` | ADMIN | `update` |
| DELETE | `/labels/:id` | ADMIN | `remove` (hard delete) |
| DELETE | `/labels/bulk/delete` | ADMIN | `bulkRemove` |

- `CreateLabelDto`: `name` (`@MaxLength(60)`), `text` (`@MaxLength(40)`), `color`
  (`@IsHexColor` bắt buộc), `textColor?` (`@IsHexColor` optional), `icon?`
  (`@MaxLength(60)`), `defaultDurationDays?` (`@IsInt @Min(0)`).
- Guard viết: `JwtAccessGuard` + `RolesGuard` + `@Roles('ADMIN')` — đọc là public.
- Seed 3 label mặc định: Hot (7 ngày), New (14 ngày), Editor's Choice (không hết hạn).

### A.3 Gán label vào Story — 1 label / truyện, có hạn

- DTO `create-story.dto.ts` / `update-story.dto.ts` thêm 2 field optional:
  `labelId?: number | null` (gán/gỡ label) và `labelDurationDaysOverride?: number`
  (`@Min(0)` — ghi đè số ngày mặc định của label).
- **`create`** (`stories.service.ts`): nếu `labelId !== undefined`, gọi
  `computeLabelFields(labelId, override)` → set `labelAssignedAt = now`,
  `labelExpiresAt = now + (override ?? label.defaultDurationDays) ngày` (null nếu
  không có override và label không có `defaultDurationDays`, hoặc `days <= 0`).
- **`updateStory`**: CHỈ tính lại 3 field label khi:
  - có `labelDurationDaysOverride` (dù `labelId` không đổi) → re-pin theo số ngày mới, hoặc
  - `labelId` đổi khác giá trị hiện tại (gán label khác, hoặc gỡ về `null`).
  Nếu `labelId` không đổi VÀ không có override → giữ nguyên `labelAssignedAt`/
  `labelExpiresAt` (sửa các field khác của truyện không làm reset đồng hồ đếm hạn).
- `labelId == null` (gỡ label) → `computeLabelFields` trả `{ labelId: null, labelAssignedAt: null, labelExpiresAt: null }`.

### A.4 Serving — `serializeStory` + `activeLabel` (thay `computeBadge`)

`stories.service.ts` có `activeLabel(story)`: trả `null` nếu `!story.labelId ||
!story.label`; nếu có `labelExpiresAt` và `Date.now() >= exp` → cũng trả `null`
(label hết hạn không hiện nữa, dù cột DB vẫn còn giá trị — tính "active" ở READ TIME,
không có cron xoá). Ngược lại trả object:

```ts
{ id, name, text, color, textColor: textColor ?? null, icon: icon ?? null }
```

`serializeStory` gọi `activeLabel` rồi gắn vào field `label` của response, đồng thời
loại field thô `label`/`labelAssignedAt`/`labelExpiresAt` khỏi payload trả ra. Được
gọi ở mọi đường trả Story: `create`, `updateStory`, `getHomeStories` (trending/
newest/featured), `exploreStories`, `findAllAdmin`, `findOneAdmin`, `getStoryDetail`,
`getRecommendedStories`, `updateRecommended` — tức mọi Story trả ra ngoài (public +
admin) đều đi qua `select` có `labelId`/`label`/`labelExpiresAt` rồi qua
`serializeStory`.

### A.5 Admin (`fe/apps/admin`)

- Nav item mới "Quản lý Label" → route `/labels` (`AdminShellLayout.tsx`), trang
  `app/[lang]/labels/page.tsx` — clone layout trang Categories + modal `LabelForm`
  (color picker + preview).
- `StoryForm.tsx` (form tạo/sửa truyện) — thêm khu vực chọn 1 Label (single-select,
  không multi) + input "số ngày gắn (override)" trong section "Phân loại".

### A.6 Client — app (novelverse) và web

- **App**: `Book.tag` (String, whitelist cứng + demo tag random) đã bị bỏ, thay bằng
  `Book.label` kiểu `StoryLabel? {text, color, icon?}` (`lib/models/models.dart`).
  Mapper backend→Book đọc trực tiếp `j['label']` (không còn whitelist/random).
  Widget badge bìa ở `lib/screens/novel/novel_home_screen.dart` render `label.text`
  trên nền `label.color` — parse hex an toàn (`int.tryParse`, không crash nếu màu
  sai định dạng).
- **Web**: `StoryGridCard.tsx` nhận thêm field `label?: {text, color, icon?} | null`
  — render pill badge mới (`story.label.color` làm background). Web **trước đây
  chưa từng có** badge bìa nào (net-new, không phải thay thế).

═══════════════════════════════════════════════════════════════════════
## B1. BẢNG XẾP HẠNG TOÀN CỤC — `GET /stats/top-stories`
═══════════════════════════════════════════════════════════════════════

File: `be/src/stats/stats.service.ts` + `stats.controller.ts` +
`dto/top-stories-query.dto.ts`.

### B1.1 Endpoint

`GET /stats/top-stories?metric=<>&limit=100&language=?` — ADMIN
(`JwtAccessGuard`+`RolesGuard`+`@Roles('ADMIN')`). Query:
- `metric` (bắt buộc) — enum `TopStoryMetric` (khai báo trong `stats.service.ts`):
  `reads | rating | comments | favorites | gifts | trending | revenue | audio | search`.
- `limit?` (`@Min(1) @Max(100)`, default 100).
- `language?` (key ngôn ngữ, ví dụ `"vi"`).

Response: `{ data: [{ rank, storyId, title, slug, thumbnailUrl, value }] }`. Mọi
truy vấn loại `stories.deleted_at IS NOT NULL`.

### B1.2 Định nghĩa từng metric (đọc đúng `getTopStories`/`getTopStoriesAggregated`)

3 metric đọc counter có sẵn trên `Story` (qua `story.findMany` + `orderBy`):
- **reads** = `stories.total_views`
- **favorites** = `stories.favorites_count`
- **gifts** = `stories.total_gifts`

5 metric còn lại tính bằng `$queryRaw` (raw SQL, tagged template, có `Prisma.sql`/
`Prisma.empty` để chèn điều kiện `language` khi có; BigInt kết quả ép về `Number`):
- **comments** = `COUNT(chapter_comments.id) WHERE chapter_comments.story_id = s.id AND is_hidden = 0` (đếm sống, không có counter cache).
- **audio** = `COUNT(DISTINCT listening_history.user_id) WHERE story_id = s.id` — tức số **người nghe duy nhất**, không phải số lượt nghe.
- **revenue** = `stories.total_gifts + SUM(user_story_unlocks.pulse_amount) + SUM(user_chapter_unlocks.pulse_amount qua JOIN chapters ON chapters.story_id)` — quà tặng + Pulse mở nguyên truyện + Pulse mở từng chương.
- **rating** = Bayesian average, `m = 10`:
  `value = (rating_count/(rating_count+m)) * average_rating + (m/(rating_count+m)) * C`,
  với `C = AVG(average_rating) trong toàn bảng stories WHERE rating_count > 0 AND deleted_at IS NULL`.
  Chỉ xét truyện có `rating_count > 0` (truyện chưa ai rate không vào bảng xếp hạng này).
- **trending** = suy giảm 30 ngày, hệ số 0.9/ngày:
  `SUM(story_view_daily.views * POW(0.9, DATEDIFF(UTC_DATE(), story_view_daily.date)))`
  với `story_view_daily.date >= UTC_DATE() - 29 ngày` (tức đúng 30 ngày kể cả hôm nay).
- **search** (B2a bổ sung) = `SUM(story_country_daily.count) WHERE kind = 'search'` — tổng mọi quốc gia (metric toàn cục, không lọc quốc gia).

Sau khi có `rows` (id + value) từ raw SQL, service query lại `story.findMany` theo
`id IN (...)` lấy `title/slug/thumbnailUrl` rồi hydrate theo đúng thứ tự `rows`
(giữ nguyên rank đã sort ở SQL).

### B1.3 Bảng nguồn `StoryViewDaily` — do cron flush ghi

Bảng `story_view_daily` (`storyId`, `date` [UTC midnight], `views`) được nạp bởi
đúng cron **có sẵn** `TrackingService.flushTrackingCounters` (`@Cron(EVERY_5_MINUTES)`,
`be/src/tracking/tracking.service.ts`) — KHÔNG có cron riêng. Trong mỗi lần flush,
song song với việc `story.updateMany({ totalViews: { increment: count } })` như cũ,
service còn `upsert` bucket hôm nay qua helper thuần hàm `buildDailyViewUpsertArgs
(storyId, count, day)`:

```ts
{ where: { storyId_date: { storyId, date: day } },
  create: { storyId, date: day, views: count },
  update: { views: { increment: count } } }
```

→ bảng này là nguồn cho `reads` (gián tiếp, qua `total_views`) và trực tiếp cho
`trending`; **không bị ảnh hưởng bởi geo** (B2a) — luôn cộng dồn view toàn cục dù
resolve được quốc gia hay không.

═══════════════════════════════════════════════════════════════════════
## B2a. GÁN QUỐC GIA ẨN DANH (view + search) + metric `search`
═══════════════════════════════════════════════════════════════════════

### B2a.1 Helper geo — `be/src/common/geo/geo.util.ts`

```ts
clientIp(req)       // ưu tiên header x-forwarded-for (lấy phần tử đầu), fallback req.socket.remoteAddress
resolveCountry(ip?)  // geoip-lite → mã ISO 2 ký tự UPPERCASE, hoặc null
```

`resolveCountry` trả `null` khi: không có `ip`; IP là localhost
(`127.0.0.1`/`::1`/`localhost`); IP thuộc dải private (`192.168.*`, `10.*`,
`172.16.0.0–172.31.255.255` qua regex `/^172\.(1[6-9]|2\d|3[01])\./`). IPv4-mapped
IPv6 (`::ffff:x.x.x.x`) bị strip prefix `::ffff:` trước khi kiểm tra. (`geoip-lite`
đã được dùng sẵn ở module `auth` để set `User.country` — B2a tái dùng đúng package,
KHÔNG cùng hàm; xem mục "Follow-up".)

### B2a.2 Gán quốc gia cho VIEW

`TrackingController.trackView` nhận thêm `@Req() req` → tính `clientIp(req)` →
truyền vào `TrackingService.trackView(dto, ip)`. Trong hàm `track()` chung (dùng
cho cả `view`/`listen`), SAU khi một lượt xem được tính là "counted" (qua dedup
Redis `SET NX`), nếu `resolveCountry(ip)` ra được quốc gia, service `INCR` thêm 1
counter Redis namespace riêng: **`story:geo:view:<storyId>:<country>`** (prefix
`story:geo:` — tách biệt hoàn toàn khỏi `story:views:`/`chapter:views:` để không
đụng logic scan/flush cũ). `trackListen` KHÔNG nhận IP (controller không lấy
`@Req`) → sự kiện `listen` không có geo.

### B2a.3 Sự kiện search-open

`POST /tracking/search-open` — public, body `SearchOpenDto { storyId: string
(nhận cả slug HOẶC uuid), deviceId: string (@Length(8,128)) }`, `@Req()` để lấy IP.

`TrackingService.trackSearchOpen`:
1. Resolve `storyId` thành id thật qua `story.findFirst({ OR: [{id: storyId},
   {slug: storyId}], deletedAt: null })` — **canonical id**: app gửi slug, web gửi
   id, cả hai đều quy về đúng 1 dòng dữ liệu.
2. Không tìm thấy truyện → `{ counted: false, notFound: true }` (không lỗi 4xx).
3. Dedup theo `track:search:<id>:<deviceId>` (TTL 1h, giống dedup view/listen).
4. Nếu đã đếm (không trùng) và resolve được quốc gia → `INCR
   story:geo:search:<id>:<country>`.

### B2a.4 Flush geo → `StoryCountryDaily`

Trong `flushTrackingCounters`, SAU đoạn flush view/chapter hiện có, thêm 1 block
riêng (bọc `try/catch`, lỗi chỉ log rồi bỏ qua — KHÔNG làm hỏng flush view/chapter
đã chạy xong): scan `story:geo:*`, parse suffix `<kind>:<storyId>:<country>`, dùng
lại đúng kỹ thuật swap an toàn (RENAME key gốc → key processing → GET giá trị) như
view/chapter, rồi `upsert` vào `story_country_daily` qua helper thuần hàm
`buildStoryCountryUpsertArgs(storyId, country, kind, count, day)` — cùng đưa vào
`$transaction(writes)` chung với các write view/chapter/story_view_daily của chu
kỳ đó (1 transaction duy nhất cho cả cycle).

### B2a.5 3 endpoint stats geo + metric `search` toàn cục (đều ADMIN)

| Endpoint | Query | Response |
|---|---|---|
| `GET /stats/top-countries` | `metric`, `limit? (≤100, default 20)` | `{ data: [{rank, country, value}] }` |
| `GET /stats/top-stories-by-country` | `country`, `metric`, `limit? (≤100, default 100)` | `{ data: [{rank, storyId, title, slug, thumbnailUrl, value}] }` |
| `GET /stats/story-top-countries` | `storyId`, `metric?` (default `'view'`), `limit? (≤50, default 5)` | `{ data: [{country, value}] }` |

**`metric` (cả 3 endpoint)** lúc B2a chỉ nhận `view|search`; **B2b** mở rộng thêm
`favorite|comment|rating|gift|revenue|listen`; **C** thêm `trending` → hiện `@IsIn`
của cả 3 DTO geo = `view|search|favorite|comment|rating|gift|revenue|listen|trending`
(9 giá trị). Chi tiết nhánh `trending` xem mục **C**.

Cả 3 đều raw SQL trực tiếp trên `story_country_daily` (`SUM(count) GROUP BY ...`),
hydrate lại `title/slug/thumbnailUrl` khi cần (order-preserving theo `rows` đã sort).
Metric **search toàn cục** ở `/stats/top-stories?metric=search` (mục B1.2) cũng đọc
từ `story_country_daily` (kind='search') nhưng SUM mọi quốc gia — không lọc theo 1
quốc gia như 3 endpoint geo trên.

⚠ Khác với `getTopStoriesByCountry`/`getStoryTopCountries`, hàm `getTopCountries`
KHÔNG có điều kiện loại `stories.deleted_at` (không JOIN `stories`) — chưa rõ có
chủ đích hay sót, xem mục Deferred.

### B2a.6 Client gửi event search-open

- **Web** (`fe/apps/web/src/app/[lang]/(main)/search/page.tsx`): khi user mở 1 kết
  quả tìm kiếm, gọi `POST /tracking/search-open { storyId: story.id, deviceId }`
  (tái dùng `getOrCreateDeviceId` + `apiClient` có sẵn của web).
- **App** (novelverse): file mới `lib/data/device_id.dart` —
  `getOrCreateDeviceId()` đọc/ghi `SharedPreferences` key `wta_device_id`, sinh id
  mới bằng `DateTime` + `Random` (KHÔNG dùng package `uuid`) nếu chưa có. Repository
  `StoriesRepository.trackSearchOpen(storyId, deviceId)` gọi
  `ApiEndpoints.trackSearchOpen = '/tracking/search-open'`. Gắn vào đúng 2 điểm
  tap kết quả search ở `lib/screens/novel/discover_screen.dart`
  (`_featureImage`, `_resultRow`) qua helper `_trackSearchOpen(b)` — CHỈ bắn khi
  đang gõ tìm kiếm (`_searchCtrl.text.trim().isNotEmpty`), fire-and-forget (không
  `await`, không chặn `context.push`). App gửi `Book.id` — cần lưu ý: ở app hiện
  `Book.id` được map từ **slug** của truyện (không phải uuid) — đúng lý do
  `SearchOpenDto.storyId` phải nhận được cả 2 dạng.

═══════════════════════════════════════════════════════════════════════
## B2b. GÁN QUỐC GIA CHO 6 HÀNH ĐỘNG NGƯỜI DÙNG (IP thời điểm)
═══════════════════════════════════════════════════════════════════════

B2a chỉ gán quốc gia cho `view`/`search`. B2b bổ sung 6 kind cho **hành động người
dùng** — lấy quốc gia từ IP TẠI THỜI ĐIỂM hành động — để bảng xếp hạng theo quốc gia
có đủ các metric người dùng. **KHÔNG migration** (chỉ thêm giá trị chuỗi `kind`).

### B2b.1 `GeoService` dùng chung — `be/src/common/geo/geo.service.ts` (+ `geo.module.ts`)

```ts
record(storyId, ip, kind, value = 1)   // fire-and-forget, KHÔNG throw, KHÔNG chặn action gốc
  if (value <= 0) return;
  const country = resolveCountry(ip);  // helper B2a; null → return (no-op)
  if (!country) return;
  day = hôm nay 00:00 UTC;
  storyCountryDaily.upsert({ where: storyId_country_date_kind, create {count: value}, update {count: increment value} })
  // toàn bộ trong try/catch — lỗi geo bị nuốt (geo là phụ)
```

`GeoModule` export `GeoService`; các module hành động import để dùng. Khác cơ chế
Redis-buffer của view (B2a): B2b **upsert đồng bộ ngay tại write-site** (volume thấp;
`listen` buộc ghi đồng bộ vì persistence listen chạy ở cron 5' không có IP).

### B2b.2 Điểm gọi (`void this.geo.record(...)` — fire-and-forget, ĐÚNG chỗ write thật)

| kind | value | Vị trí (đọc code) |
|---|---|---|
| `favorite` | 1 | `user-features.service.ts:239` — nhánh ADD của `toggleFavorite` (bỏ toggle-off KHÔNG ghi) |
| `listen` | 1 | `user-features.service.ts:463` — `syncHistory` (ghi đồng bộ, `dto.storyId`) |
| `comment` | 1 | `chapter-comments.service.ts:288` — sau `create` (`chapter.storyId`) |
| `rating` | 1 | `reviews.service.ts:242` — sau `upsertReview` (đếm MỖI lượt rate; rating theo quốc gia = ĐẾM, không phải trung bình) |
| `gift` | `numericAmount` (Pulse) | `stories.service.ts:1208` — `giftPulse`, SAU `$transaction` thành công |
| `revenue` | `finalPrice` (Pulse) | `stories.service.ts:987` (unlock nguyên truyện, SAU tx) + `chapters.service.ts:540` (unlock chương nhánh PULSE trả phí, SAU tx). VIP/AD/timed (Pulse 0) → KHÔNG ghi. |

Controller lấy IP qua `clientIp(req)` (helper B2a), thêm `@Req` nơi chưa có. Đặt lời
gọi SAU khi write chính thành công (tôn trọng early-return/idempotent — favorite gỡ,
unlock đã mở, gift/unlock ngoài transaction tiền tệ). Test: `geo.service.spec.ts`.

### B2b.3 Metric geo mở rộng

3 DTO geo (`top-countries`/`stories-by-country`/`story-top-countries`) mở `@IsIn`
nhận thêm 6 kind trên. Service SQL không đổi (đã `GROUP BY kind` = metric). Global
rankings của 6 metric này đã có từ B1 (counter/aggregation) — B2b chỉ thêm chiều
quốc gia.

═══════════════════════════════════════════════════════════════════════
## C. MENU ADMIN "BẢNG XẾP HẠNG" + trending-per-country
═══════════════════════════════════════════════════════════════════════

Sub-project C = UI admin tiêu thụ toàn bộ API B1/B2a/B2b, + 1 bổ sung backend nhỏ
(trending-per-country) để cả 3 menu geo đủ 9 metric. **KHÔNG migration.**

### C.1 Backend — trending-per-country (`stats.service.ts` + 3 DTO geo)

`trending` thêm vào `@IsIn` của 3 DTO geo. 3 method service (`getTopCountries`,
`getTopStoriesByCountry`, `getStoryTopCountries`) thêm nhánh `metric === 'trending'`:
thay `SUM(count) WHERE kind = <metric>` bằng decay trên `kind='view'`, **giống hệt
công thức trending toàn cục** (mục B1.2):

```
SUM(count * POW(0.9, DATEDIFF(UTC_DATE(), date)))  WHERE kind='view'
  AND date >= DATE_SUB(UTC_DATE(), INTERVAL 29 DAY)
```

→ geo-trending = "xu hướng" trong tập traffic có-quốc-gia (subset IP resolve được),
nhất quán với cách geo chỉ tính traffic resolve được (global trending dùng
`story_view_daily` = toàn bộ view — khác nguồn, chấp nhận).

### C.2 Frontend admin (`fe/apps/admin`)

- **Nav**: nhóm gấp gọn "Bảng xếp hạng" (`AdminShellLayout.tsx`, icon `BarChart3`)
  với 3 con: Top Truyện `/rankings/top-stories`, Top Quốc gia `/rankings/top-countries`,
  Xếp hạng theo quốc gia `/rankings/by-country`.
- **`src/lib/ranking-metrics.ts`** — NGUỒN SỰ THẬT ánh xạ 9 metric UI → tham số API:
  mỗi metric `{ key, label, storyMetric, geoKind }`. `storyMetric` cho
  `/stats/top-stories`; `geoKind` cho 3 endpoint geo. Bảng: `reads→view`,
  `rating→rating`, `comments→comment`, `favorites→favorite`, `gifts→gift`,
  `trending→trending`, `search→search`, `revenue→revenue`, `audio→listen`.
  `formatMetricValue(metric, value, isGeo)` — rating global (Bayesian) = `.toFixed(2)`;
  rating geo (đếm sự kiện) + mọi metric đếm = số nguyên; trending = làm tròn.
- **`src/lib/country-name.ts`** — `countryName(code)` qua `Intl.DisplayNames(['vi'],
  {type:'region'})`, fallback về mã in hoa.
- **Component dùng chung** (`app/[lang]/rankings/_components/`): `MetricSwitcher`
  (pill 9 metric), `RankingTable` (bảng truyện, có slot `renderExpand`/`onExpand` lazy).
- **3 trang** (`app/[lang]/rankings/{top-stories,top-countries,by-country}/page.tsx`):
  gọi `adminApiClient` (pass-through) + `unwrapList`. Top Truyện: đổi metric refetch +
  reset cache + `key={metricKey}` remount; bung 1 dòng → lazy `story-top-countries`
  (dedup, guard `metricKeyRef` chống response cũ khi đổi metric giữa chừng). By-country:
  danh sách quốc gia từ `top-countries?metric=view` (dropdown xếp theo tên, mặc định
  chọn quốc gia nhiều view nhất = phần tử đầu của response value-desc).
- **Không unit-test runner ở admin** → cổng kiểm tra là `tsc --noEmit` (baseline sạch).

═══════════════════════════════════════════════════════════════════════
## D. DEFERRED / FOLLOW-UP — chưa làm, cần theo dõi
═══════════════════════════════════════════════════════════════════════

1. **Prod migration CHƯA CHẠY**: cả 3 migration ở mục 0 (`labels`+`stories.label_id`
   cols, `story_view_daily`, `story_country_daily`) mới chỉ áp dụng LOCAL. B2b/C
   không thêm migration nhưng vẫn cần 3 migration này trên prod.
2. **Follow-up nhỏ backend** (ghi nhận, chưa sửa):
   - `StoryTopCountriesQueryDto` chưa có `@Max(50)` (validate limit).
   - `getTopCountries` không loại `deleted_at` (không JOIN `stories`) — cả nhánh cũ
     lẫn nhánh trending; cần xác nhận có chủ đích hay sót.
   - `auth` module (set `User.country`) có thể refactor dùng lại `resolveCountry` chung.
   - Production cần cấu hình Express `trust proxy` — `x-forwarded-for` hiện tin trực
     tiếp, có thể bị giả mạo nếu không có reverse proxy chuẩn hoá header.
   - `geoip-lite` cần job cập nhật CSDL địa lý định kỳ.
   - rating theo quốc gia hiện ĐẾM mỗi lượt upsert (re-rate cũng +1) — nếu muốn chỉ
     đếm lần đầu cần pre-check tồn tại.
3. **Follow-up nhỏ admin UI C** (Minor từ review, chưa sửa):
   - Test backend bất đối xứng: chỉ `getTopCountries`/`TopCountriesQueryDto` có test
     negative/validate; 2 method/DTO còn lại widening giống hệt nhưng chưa có test riêng.
   - Cả 3 trang: fetch lỗi → `rows=[]` (không phân biệt "lỗi mạng" vs "rỗng thật");
     bung dòng lỗi chặn retry đến khi đổi metric.
   - Top Truyện: staleness bung dòng khoá theo giá trị metricKey, không phải token
     mỗi request → còn hở hẹp A→B→A cùng metric (không phải regression).
   - by-country: `metric.geoKind` chưa `encodeURIComponent` (vô hại, ASCII tĩnh);
     nháy 1 frame empty-state trước khi hiện loading; `<select>` chưa có `aria-label`.
4. **Browser smoke chưa chạy**: cần đăng nhập admin ở `localhost:9003` → menu Bảng
   xếp hạng (đổi metric, bung top-5 quốc gia, chọn quốc gia) để xác nhận runtime.

═══════════════════════════════════════════════════════════════════════
## Liên quan / xem thêm
═══════════════════════════════════════════════════════════════════════
- [02-be-stories-chapters.md](02-be-stories-chapters.md) — vùng Stories/Chapters
  (nơi `serializeStory` sống, cạnh các field label).
- [02-be-other-modules.md](02-be-other-modules.md) — module `tracking` (Redis
  buffer + cron flush) và `stats` trước khi có B1/B2a.
- [04-database.md](04-database.md) — schema Prisma đầy đủ.
- [10-mobile-api.md](10-mobile-api.md) — hợp đồng API mobile (nên bổ sung
  `/tracking/search-open` nếu cập nhật file đó).
- `superpowers/specs/2026-07-09-story-labels-design.md`,
  `superpowers/specs/2026-07-09-story-rankings-b1-global-design.md`,
  `superpowers/specs/2026-07-09-story-rankings-b2a-geo-design.md`,
  `superpowers/specs/2026-07-09-story-rankings-b2b-user-geo-design.md`,
  `superpowers/specs/2026-07-09-story-rankings-c-admin-ui-design.md` — thiết kế gốc
  (rationale, alternatives, phân rã task) cho A/B1/B2a/B2b/C.
