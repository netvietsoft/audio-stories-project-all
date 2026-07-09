# Story Rankings — Sub-project B1 (Global metric rankability) — Design

> Ngày: 2026-07-09 · Repo: NovelApp backend (NestJS `be/`). · Loạt "Label + Bảng xếp hạng": A (Labels) ĐÃ xong.
> **B** = nền cho các menu xếp hạng (C). Đã tách: **B1** (xếp hạng TOÀN CỤC 9 metric) trước, **B2** (gắn quốc gia theo IP) sau.
> Spec này chỉ là **B1**. Trạng thái: design chờ user duyệt → plan.

## 1. Mục tiêu
Làm cho các metric truyện **xếp hạng được toàn cục** (top N, mặc định 100) và cung cấp **1 endpoint đọc** để menu "Top Truyện" (sub-project C) gọi. B1 = **backend only**, không có UI admin (đó là C).

## 2. Phạm vi
**Trong (B1):** 8 metric xếp hạng toàn cục + endpoint `GET /stats/top-stories`. Thêm bảng `StoryViewDaily` (view theo ngày) để tính **trending thật**. 3 metric không có counter (comments/audio/revenue) tính **live aggregation** lúc truy vấn (rẻ vì admin gọi thưa; theo tiền lệ `StatsService.getVipChapterStats`).

**Ngoài (B2 / sau):**
- **Metric "tìm kiếm nhiều" (search)** — HOÃN sang B2 (chưa có log nào; cần event mới do client gửi → làm cùng hạ tầng event của B2).
- **Gắn quốc gia theo IP** + per-(truyện, quốc gia) + menu Top Quốc gia / Xếp hạng theo quốc gia + cột "top 5 quốc gia" → **B2**.
- **UI admin các menu Top** → **C**.

## 3. Quyết định đã chốt (brainstorm 2026-07-09)
1. **Revenue** = Pulse mở khoá **+ quà tặng**: `SUM(UserStoryUnlock.pulseAmount) + SUM(UserChapterUnlock.pulseAmount qua Chapter.storyId) + Story.totalGifts`.
2. **Trending** = điểm thật, cửa sổ **30 ngày, decay 0.9/ngày**: `score = Σ_{d=0..29} views_d × 0.9^d` (d=0 là hôm nay), lấy từ `StoryViewDaily`.
3. **Rating** = **Bayesian average**: `score = (v/(v+m))×R + (m/(v+m))×C`, với `v`=ratingCount, `R`=averageRating, `m=10` (prior), `C`=trung bình averageRating toàn cục (chỉ tính truyện có ratingCount>0).
4. **Audio-listens** = **unique listeners**: `COUNT(DISTINCT userId)` trong `ListeningHistory` theo storyId.
5. **Live aggregation** cho comments/audio/revenue (không thêm counter mới, tránh drift). 5 counter sẵn có giữ nguyên. Trending cần bảng ngày mới.
6. Search → B2. Geo → B2. UI → C.

## 4. Metric → nguồn & cách xếp hạng (8 metric)
| # | Metric | Nguồn | Cách rank (đều loại `deletedAt IS NOT NULL`; lọc `language` tuỳ chọn) |
|---|--------|-------|------|
| 1 | reads | `Story.totalViews` (BigInt, counter) | ORDER BY totalViews desc |
| 2 | rating | `Story.averageRating` + `ratingCount` | Bayesian (m=10, C=global mean); truyện ratingCount=0 loại; tie-break ratingCount desc |
| 3 | comments | `ChapterComment` (storyId, isHidden) | live `COUNT(*) WHERE isHidden=false GROUP BY storyId` desc |
| 4 | favorites | `Story.favoritesCount` (counter) | ORDER BY favoritesCount desc |
| 5 | gifts | `Story.totalGifts` (counter) | ORDER BY totalGifts desc |
| 6 | trending | `StoryViewDaily` (mới) | live weighted-sum 30 ngày (POW(0.9, DATEDIFF)) desc |
| 7 | revenue | `UserStoryUnlock` + `UserChapterUnlock`⋈`Chapter` + `Story.totalGifts` | live SUM (xem §3.1) desc |
| 8 | audio | `ListeningHistory` (userId, storyId) | live `COUNT(DISTINCT userId) GROUP BY storyId` desc |

## 5. Data model
**Bảng mới `StoryViewDaily`** (view theo ngày, phục vụ trending — và tái dùng cho B2/analytics sau):
```prisma
model StoryViewDaily {
  storyId String   @map("story_id") @db.VarChar(36)
  date    DateTime @db.Date
  views   Int      @default(0) @db.UnsignedInt
  story   Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)
  @@id([storyId, date])
  @@index([date])
  @@map("story_view_daily")
}
```
+ back-relation `storyViewDaily StoryViewDaily[]` trên `Story`. Migration `add_story_view_daily`. ⚠ `.sql` bị gitignore → prod cần `prisma migrate deploy`.

**Không** thêm cột counter nào khác (comments/audio/revenue tính live).

**Sửa flush view (`TrackingService.flushTrackingCounters`, cron 5 phút):** ngoài `story.updateMany({ totalViews: { increment } })` hiện có, **upsert thêm** bucket hôm nay:
`storyViewDaily.upsert({ where:{ storyId_date:{storyId, date: today} }, create:{ storyId, date: today, views: delta }, update:{ views:{ increment: delta } } })` với `delta` = số view gộp của story đó trong đợt flush (dùng chính con số đang increment vào totalViews). `today` = ngày UTC (chuẩn hoá 00:00). Không đụng client, không đổi Redis buffer.

## 6. Endpoint xếp hạng
`GET /stats/top-stories?metric=<reads|rating|comments|favorites|gifts|trending|revenue|audio>&limit=100&language=?`
- Guard: admin (JwtAccessGuard + RolesGuard @Roles('ADMIN')) — mirror `StatsController.getVipChapterStats`. (C là menu admin.)
- `metric` bắt buộc (@IsEnum 8 giá trị); `limit` default 100, max 100; `language` tuỳ chọn (key 'vi'/'en').
- Trả về (unified): `{ data: [{ rank, storyId, title, slug, thumbnailUrl, value }] }` — `value` là số của metric (BigInt→Number). Rank 1..N theo thứ tự.
- Cài trong `StatsService.getTopStories(metric, limit, language)`:
  - Counter metrics (reads/favorites/gifts): `prisma.story.findMany({ where:{ deletedAt:null, ...lang }, orderBy, take, select })`.
  - rating: raw SQL Bayesian (C = subquery `SELECT AVG(average_rating) FROM stories WHERE rating_count>0 AND deleted_at IS NULL`), `WHERE rating_count>0`, `ORDER BY score DESC`.
  - comments: raw SQL `JOIN chapter_comments`, `WHERE is_hidden=0`, GROUP BY story, ORDER BY cnt.
  - audio: raw SQL `COUNT(DISTINCT user_id)` trên `listening_history` GROUP BY story.
  - revenue (§3.1): raw SQL `stories LEFT JOIN (SUM user_story_unlocks.pulse_amount per story) LEFT JOIN (SUM user_chapter_unlocks.pulse_amount JOIN chapters per story) ` + `+ total_gifts`, ORDER BY tổng.
  - trending: raw SQL trên `story_view_daily` `WHERE date >= CURDATE()-INTERVAL 29 DAY`, `SUM(views * POW(0.9, DATEDIFF(CURDATE(), date)))` GROUP BY story, ORDER BY score.
  - Aggregation metrics: sau khi có top storyId+value, fetch title/slug/thumbnail (JOIN trong SQL hoặc 1 query `story.findMany({ where:{ id:{ in } } })` rồi map giữ thứ tự).
- Tất cả loại `deleted_at IS NOT NULL`.

## 7. Lỗi & biên
- Truyện chưa có comment/listen/unlock → không xuất hiện (giá trị 0) — đúng.
- `StoryViewDaily` chưa có dữ liệu (mới bật) → trending rỗng cho tới khi flush chạy vài đợt; không lỗi.
- rating: truyện 0 lượt bị loại (Bayesian không áp dụng).
- BigInt totalViews → convert Number khi serialize (như serializeStory hiện có).
- `limit` clamp ≤ 100.

## 8. Testing (jest, `node node_modules/jest/bin/jest.js`)
- `getTopStories` mỗi metric: mock prisma (findMany cho counter; `$queryRaw` cho aggregation) → đúng thứ tự + shape + rank 1..N.
- Trending score: kiểm công thức weighted-sum/decay đúng trên bộ bucket giả (đơn vị hoá phần tính điểm nếu tách hàm).
- Bayesian: hàm điểm `(v/(v+m))*R + (m/(v+m))*C` đúng vài case (ít lượt kéo về C; nhiều lượt ≈ R).
- Flush: `flushTrackingCounters` upsert `StoryViewDaily` bucket hôm nay bằng delta (mock prisma.storyViewDaily.upsert + kiểm gọi đúng args).

## 9. File dự kiến
- `be/prisma/schema.prisma` (+ `StoryViewDaily`, back-relation) + migration.
- `be/src/tracking/tracking.service.ts` (flush: upsert daily bucket).
- `be/src/stats/stats.service.ts` (`getTopStories`), `stats.controller.ts` (`GET /stats/top-stories`), `dto/top-stories-query.dto.ts` (metric enum/limit/language).
- Test: `be/src/stats/top-stories.spec.ts` (+ trending/bayesian unit, flush spec).

## 10. Ghi chú / follow-up
- **B2** dùng lại `StoryViewDaily` pattern + thêm chiều **country** (per (story, country[, ngày]) từ IP→geoip trong tracking) → mở "Top Quốc gia", "xếp hạng theo quốc gia", cột "top 5 quốc gia". Search (metric #9) làm ở B2 (event 'mở truyện từ tìm kiếm').
- **C** = UI admin các menu Top (gọi `/stats/top-stories` + các endpoint B2).
- Live aggregation top-100 chạy trên toàn bộ truyện: admin gọi thưa nên chấp nhận; nếu số truyện rất lớn sau này → cân nhắc counter/materialized.
- Prod: `prisma migrate deploy` cho bảng `story_view_daily`.
