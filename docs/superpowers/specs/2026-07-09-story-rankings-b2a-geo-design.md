# Story Rankings — Sub-project B2a (Anonymous geo: view + search) — Design

> Ngày: 2026-07-09 · Repo: NovelApp backend (NestJS `be/`) + app `novelverse` + web `fe/apps/web`.
> Loạt "Label + Bảng xếp hạng": A (Labels) ✅, B1 (global metrics) ✅. **B2** (gắn quốc gia theo IP thời-điểm) tách: **B2a** (sự kiện ẩn danh: view + search) trước, **B2b** (metric người-dùng: favorite/comment/rating/gift/unlock/listen) sau. **C** = UI menu.
> Spec này chỉ **B2a**. Trạng thái: design chờ user duyệt → plan.

## 1. Mục tiêu
Gắn **quốc gia** (theo IP thời-điểm) cho 2 sự kiện ẩn danh — **xem (view)** và **mở-truyện-từ-tìm-kiếm (search-open)** — và lưu theo `(truyện, quốc gia, ngày, loại)` để mở khoá (cho C): **Top Quốc gia** (theo reads/search), **xếp hạng truyện theo 1 quốc gia** (reads/search), **cột "top 5 quốc gia" mỗi truyện**, và metric **search** toàn cục (B1 đã hoãn).

## 2. Phạm vi
**Trong (B2a):**
- BE: helper `resolveCountry(ip)`; bắt IP trong tracking (`trackView` + endpoint search-open mới); Redis counter theo `(truyện,quốc gia,loại)` + flush → bảng `StoryCountryDaily`; endpoint search-open; 3 endpoint xếp hạng geo + nối `metric=search` vào `/stats/top-stories`.
- App (novelverse) + Web (fe/apps/web): gọi `POST /tracking/search-open` khi user mở truyện từ kết quả tìm kiếm.

**Ngoài (B2b / sau):**
- Gắn quốc gia cho metric NGƯỜI-DÙNG (favorite/comment/rating/gift/unlock/listen) — bắt IP thời-điểm trên các endpoint đó → **B2b**.
- Refactor auth để dùng chung `resolveCountry` (auth hiện lặp 3 lần) — follow-up, không đụng trong B2a (tránh rủi ro).
- UI admin các menu (Top Quốc gia, xếp hạng theo quốc gia...) → **C**.

## 3. Quyết định đã chốt (brainstorm 2026-07-09)
1. **IP thời-điểm** (không dùng User.country) cho view/search: bắt IP request lúc sự kiện, giải quốc gia server-side.
2. **Quốc gia** = mã ISO 2 ký tự (từ `geoip.lookup(ip).country`). IP không giải được (localhost/private/không thấy) → **bỏ qua** (không ghi bucket quốc gia; view toàn cục vẫn đếm như B1).
3. **Search-open dedup** theo device/giờ (giống trackView): 1 lần/thiết bị/giờ cho mỗi truyện.
4. **Full slice**: BE + app + web (client gửi event search-open).
5. Lưu geo tách khỏi B1: `StoryCountryDaily` (không đụng `StoryViewDaily`/`totalViews` toàn cục).

## 4. Geo foundation
**Helper mới** `be/src/common/geo/resolve-country.util.ts`:
- `clientIp(req): string | undefined` — `(req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress`, lấy phần tử đầu `.split(',')[0].trim()` (mirror auth).
- `resolveCountry(ip?: string): string | null` — nếu thiếu ip → null; bỏ localhost/private (`127.`, `::1`, `10.`, `192.168.`, `172.16–31.`, `::ffff:` prefix chuẩn hoá); `geoip.lookup(ip)` → trả `geo.country` (2 ký tự, upper) hoặc null. Không throw.
- ⚠ **Trust proxy**: BE chưa cấu hình `trust proxy`; XFF do client gửi nên **giả mạo được** nếu không có proxy tin cậy ghi đè. B2a mirror đúng cách auth đang làm (chấp nhận rủi ro tương đương); prod nên đặt trust proxy / proxy ghi đè XFF (follow-up hạ tầng).
- ⚠ `geoip-lite` DB đóng gói sẵn, cũ dần; không có job cập nhật (follow-up).

## 5. Tracking: bắt IP + đếm theo quốc gia + flush
- **`trackView`**: controller thêm `@Req() req`; `const ip = clientIp(req)`; truyền vào `TrackingService.trackView(dto, ip)`. Trong `track()`, khi sự kiện **được đếm** (qua dedup deviceId hiện có), resolve `country = resolveCountry(ip)`; nếu `country`, `INCR` thêm key namespace RIÊNG: `story:geo:view:<storyId>:<country>` (prefix `STORY_GEO_PREFIX='story:geo:'`, KHÔNG trùng `story:views:` để không phá flush cũ). Counter toàn cục `story:views:<storyId>` + `StoryViewDaily` (B1) giữ nguyên.
- **Flush geo** (trong `flushTrackingCounters` hoặc collector riêng cùng cron): scan `story:geo:*`; mỗi key parse `kind:storyId:country`; dùng cùng cơ chế RENAME→processing→GET count an toàn; upsert `StoryCountryDaily` (increment `count`) vào cùng `$transaction(writes)` (rollback/restore như B1). `today` = UTC midnight (như B1).
- **`search-open`**: `POST /tracking/search-open` body `SearchOpenDto { storyId, deviceId }` (KHÔNG chapterId); `@Req` IP; dedup key `track:search:<storyId>:<deviceId>` (TTL 3600, NX); khi đếm: resolve country → nếu có, `INCR story:geo:search:<storyId>:<country>`. (Search KHÔNG tăng counter view toàn cục.)

## 6. Storage
```prisma
model StoryCountryDaily {
  storyId String   @map("story_id") @db.VarChar(36)
  country String   @db.Char(2)
  date    DateTime @db.Date
  kind    String   @db.VarChar(10)   // 'view' | 'search'
  count   Int      @default(0) @db.UnsignedInt
  story   Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)
  @@id([storyId, country, date, kind])
  @@index([kind, country])
  @@index([kind, storyId])
  @@map("story_country_daily")
}
```
+ back-relation `storyCountryDaily StoryCountryDaily[]` trên `Story`. Migration `add_story_country_daily`. ⚠ `.sql` gitignore → prod `migrate deploy`/tạo tay.

## 7. Endpoint xếp hạng geo (StatsService/Controller, admin-guarded như /stats/top-stories)
- `GET /stats/top-countries?metric=<view|search>&limit=20` → `SELECT country, SUM(count) v FROM story_country_daily WHERE kind=? GROUP BY country ORDER BY v DESC LIMIT ?`. Trả `[{rank, country, value}]`.
- `GET /stats/top-stories-by-country?country=XX&metric=<view|search>&limit=100` → `SELECT story_id, SUM(count) v FROM story_country_daily WHERE country=? AND kind=? GROUP BY story_id ORDER BY v DESC LIMIT ?`, hydrate title/slug/thumbnail (giữ thứ tự). Trả `[{rank, storyId, title, slug, thumbnailUrl, value}]`.
- `GET /stats/story-top-countries?storyId=<id>&metric=view&limit=5` → top 5 quốc gia của 1 truyện (`WHERE story_id=? AND kind=? GROUP BY country ORDER BY SUM(count) DESC LIMIT 5`). Trả `[{country, value}]`. (Cột "top 5 quốc gia" của C — C gọi cho từng truyện trong bảng Top.)
- **Search toàn cục**: thêm `search` vào enum `TopStoryMetric` của B1; nhánh mới trong `getTopStoriesAggregated`: `SELECT s.id, SUM(scd.count) v FROM stories s JOIN story_country_daily scd ON scd.story_id=s.id AND scd.kind='search' WHERE s.deleted_at IS NULL [+lang] GROUP BY s.id ORDER BY v DESC LIMIT ?`. (Chỉ đếm search có IP giải được — chấp nhận.)
- DTO validators: `metric` @IsEnum(['view','search']); `country` @IsString @Length(2,2) (upper); `limit` @IsInt @Min(1) @Max(...); `storyId` @IsUUID/@IsString. Tất cả loại `deleted_at IS NOT NULL` khi hydrate/join stories.
- Thứ tự SQL raw + BigInt→Number như B1 (`$queryRaw`, `Prisma.sql`/`Prisma.empty` cho lang nếu cần).

## 8. Client (app novelverse + web)
- **App**: màn kết quả tìm kiếm — khi user bấm 1 truyện để mở → gọi `POST /tracking/search-open { storyId, deviceId }` (dùng client tracking sẵn có nếu có, hoặc api client). deviceId lấy như trackView hiện tại.
- **Web**: kết quả tìm kiếm — tap/click mở truyện → gọi endpoint tương tự.
- Fire-and-forget (không chặn điều hướng; nuốt lỗi).
- Plan phải **định vị** màn search + cách app/web đang gọi trackView (tái dùng cơ chế) trước khi sửa.

## 9. Lỗi & biên
- IP không giải được → không ghi geo (không lỗi); view toàn cục vẫn đếm.
- Dedup: 1 view + 1 search / device / giờ / truyện.
- Xoá truyện → `onDelete Cascade` dọn StoryCountryDaily.
- Flush geo lỗi DB → cùng cơ chế restore Redis của B1 (nằm chung $transaction).
- country lưu upper 2 ký tự; C map code→tên hiển thị (không cần Country model).
- Không có dữ liệu geo (mới bật) → endpoint trả rỗng, không lỗi.

## 10. Testing (jest)
- `resolveCountry`: localhost/private → null; IP công khai giả lập (mock geoip.lookup) → country; thiếu ip → null. `clientIp`: XFF nhiều IP → phần tử đầu; fallback remoteAddress.
- Geo flush: parse key `story:geo:view:<id>:<cc>` đúng → upsert StoryCountryDaily(kind,country,count) args đúng (helper thuần như B1 `buildDailyViewUpsertArgs`).
- track(): khi counted + country → INCR đúng key namespace geo; khi IP null → không INCR geo.
- Ranking: getTopCountries / getTopStoriesByCountry / getStoryTopCountries / search-global — mock $queryRaw → shape + rank + Number đúng.
- **Thủ công (BE up)**: mở truyện từ search trên app/web → StoryCountryDaily kind=search tăng; GET /stats/top-countries?metric=view → có nước; GET /stats/story-top-countries → top 5.

## 11. File dự kiến
- BE: `be/src/common/geo/resolve-country.util.ts` (+test); `be/prisma/schema.prisma` (StoryCountryDaily + migration); `be/src/tracking/{tracking.controller.ts,tracking.service.ts,dto/search-open.dto.ts}`; `be/src/stats/{stats.service.ts,stats.controller.ts,dto/*}` (endpoints geo + search enum).
- App: màn/handler kết quả tìm kiếm (`novelverse/lib/...`) gọi search-open.
- Web: component kết quả tìm kiếm (`fe/apps/web/...`) gọi search-open.

## 12. Ghi chú / follow-up
- **B2b**: bắt IP thời-điểm trên favorite/comment/rating/gift/unlock/listen → StoryCountryDaily thêm kind tương ứng (hoặc bảng riêng) cho 6 metric còn lại per-country.
- **C**: UI menu Top Truyện (thêm cột top-5 quốc gia gọi story-top-countries), Top Quốc gia, Xếp hạng theo quốc gia.
- Refactor auth dùng `resolveCountry` chung; đặt Express `trust proxy` ở prod; job cập nhật DB geoip — follow-up.
- Prod: `migrate deploy` cho `story_country_daily`.
