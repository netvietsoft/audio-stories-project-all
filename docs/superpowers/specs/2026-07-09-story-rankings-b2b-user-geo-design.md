# Story Rankings — Sub-project B2b (User-action geo) — Design

> Ngày: 2026-07-09 · Repo: NovelApp backend (NestJS `be/`). Loạt "Label + Rankings": A ✅, B1 ✅, B2a ✅ (anon geo view+search).
> **B2b** = mở rộng gắn quốc gia (IP thời-điểm) cho 6 metric NGƯỜI-DÙNG. **C** (UI menu) sau.
> Trạng thái: design chờ user duyệt → plan.

## 1. Mục tiêu
Cho 6 hành động người-dùng — **favorite, comment, rating, gift, unlock (revenue), listen** — ghi thêm 1 bucket per-`(story, country, date, kind)` vào bảng `StoryCountryDaily` (đã có từ B2a), lấy quốc gia từ IP request lúc hành động. Qua đó C có thể xếp hạng theo quốc gia cho cả 6 metric này (bổ sung `view`/`search` của B2a).

## 2. Phạm vi
**Trong (B2b):**
- `GeoService` dùng chung (`be/src/common/geo/geo.service.ts`): `record(storyId, ip, kind, value=1)` — resolveCountry(ip) (B2a helper); nếu có country → `storyCountryDaily.upsert` (increment `count` theo `value`) cho ngày UTC hôm nay. Fire-and-forget (nuốt lỗi, KHÔNG chặn/không rollback hành động chính).
- Bắt IP (thêm `@Req`) + gọi `GeoService.record` tại **đúng write-site** của 6 hành động (sau khi ghi chính thành công; tôn trọng early-return/idempotent).
- Mở rộng `metric` của 3 endpoint geo (top-countries, top-stories-by-country, story-top-countries) để nhận thêm 6 kind mới.

**Ngoài (C / sau):** UI admin các menu Top (dùng dữ liệu B1+B2a+B2b). Refactor auth dùng resolveCountry, trust proxy, geoip DB update — vẫn là follow-up hạ tầng.

## 3. Quyết định đã chốt (brainstorm 2026-07-09)
1. **IP thời-điểm** cho cả 6 (không dùng User.country).
2. **Cơ chế**: upsert đồng bộ trực tiếp tại write-site (KHÔNG qua Redis-buffer như view) — vì volume thấp, và `listen` buộc phải ghi đồng bộ (persistence thật của listen chạy ở cron 5' không có IP).
3. **Giá trị per kind**: `favorite`/`comment`/`rating`/`listen` = **count 1**; `gift`/`revenue` = **Pulse amount**.
4. **rating theo quốc gia = ĐẾM số lượt rating** (không phải trung bình sao). (Global rating vẫn là Bayesian avg của B1.)
5. **Ghi ngoài transaction tiền tệ**: gọi `GeoService.record` SAU khi write chính (gift/unlock $transaction) thành công — lỗi geo không được rollback tiền.
6. **kind** thêm vào cột `StoryCountryDaily.kind` (VARCHAR(10)) — **KHÔNG cần migration** (chỉ thêm giá trị chuỗi): `favorite`, `comment`, `rating`, `gift`, `revenue`, `listen`.

## 4. GeoService (dùng chung)
`be/src/common/geo/geo.service.ts` — `@Injectable`, inject `PrismaService`:
```
async record(storyId: string, ip: string | undefined, kind: string, value = 1): Promise<void> {
  try {
    const country = resolveCountry(ip);        // B2a helper (be/src/common/geo/geo.util)
    if (!country || value <= 0) return;
    const day = new Date(); day.setUTCHours(0,0,0,0);
    await this.prisma.storyCountryDaily.upsert(buildStoryCountryUpsertArgs(storyId, country, kind, value, day));
  } catch { /* fire-and-forget: geo phụ, không được ảnh hưởng hành động chính */ }
}
```
- `buildStoryCountryUpsertArgs` (B2a, export ở `tracking.service.ts`) tái dùng — hoặc chuyển vào `geo.util.ts` để GeoService + Tracking cùng dùng (tránh coupling module; quyết trong plan).
- Xuất qua `GeoModule` (providers/exports GeoService) để các module hành động import.

## 5. Write-sites (bắt IP + gọi GeoService.record) — từ recon
| kind | handler (thêm `@Req` nếu thiếu) | service write-site | value | ghi chú |
|---|---|---|---|---|
| favorite | `POST favorites/toggle` (user-features.controller) — thêm @Req | UserFeaturesService.toggleFavorite, **nhánh ADD** (sau userFavorite.create) | 1 | remove (toggle-off) = KHÔNG ghi |
| listen | `POST history/sync` — thêm @Req | UserFeaturesService.syncHistory: gọi record **đồng bộ ngay đầu/handler** (không phụ thuộc Redis/cron) | 1 | storyId = dto.storyId |
| comment | `POST chapters/:id/comments` — thêm @Req | ChapterCommentsService.create (sau chapterComment.create) | 1 | storyId = chapter.storyId (đã fetch) |
| rating | `POST stories/:id/reviews` — thêm @Req | ReviewsService.upsertReview (sau review.upsert) | 1 | đếm mỗi lượt upsert; storyId = resolveStoryId(param) |
| gift | `POST stories/:id/gift` — thêm @Req | StoriesService.giftPulse: record SAU `$transaction([...])` thành công | numericAmount (Pulse) | storyId = :id |
| revenue | `POST stories/:id/unlock` (thêm @Req) + `POST chapters/:id/unlock-by-pulse` (ĐÃ có @Req) | StoriesService.unlockStoryByPulse (SAU tx, chỉ path tạo mới — bỏ early-return đã-unlock) + ChaptersService.unlockByPulse (SAU tx, chỉ nhánh PULSE trả phí) | finalPrice (Pulse) | storyId: unlock-story = :id; unlock-chapter = chapter.storyId (đã select). VIP/AD/timed (pulseAmount 0) → KHÔNG ghi revenue. |

- Đặt lời gọi `void this.geo.record(...)` (fire-and-forget) đúng tại điểm write thật, KHÔNG ở đầu method (tránh đếm sai khi early-return/idempotent).
- Controller lấy IP: `clientIp(req)` (B2a helper); các handler chưa có `@Req` thì thêm (bên cạnh `@Account()`); 2 handler unlock-chapter đã có `@Req` → tái dùng.

## 6. Stats — mở rộng metric geo
- 3 DTO geo (`top-countries-query`, `stories-by-country-query`, `story-top-countries-query`): đổi `metric @IsIn(['view','search'])` → `@IsIn(['view','search','favorite','comment','rating','gift','revenue','listen'])`. Service SQL không đổi (đã group theo `kind`=metric). Không thêm endpoint mới.
- (Global rankings của 6 metric này ĐÃ có từ B1 qua counter/aggregation — B2b chỉ thêm chiều quốc gia.)

## 7. Lỗi & biên
- IP không giải được → GeoService.record no-op (không lỗi); hành động chính vẫn chạy.
- Lỗi ghi geo → nuốt (try/catch), không ảnh hưởng favorite/comment/gift/unlock/rating/listen.
- favorite remove, unlock đã-unlock (idempotent), VIP/AD unlock (Pulse 0) → KHÔNG ghi bucket.
- rating update (re-rate) hiện ĐẾM như 1 lượt (đơn giản; chấp nhận lạm phát nhẹ) — nếu muốn chỉ đếm lần đầu, cần pre-check tồn tại (follow-up).
- listen: ghi đồng bộ tại request (persistence listeningHistory vẫn theo cron cũ, không đụng).
- KHÔNG migration (kind là chuỗi; bảng StoryCountryDaily đã có).

## 8. Testing (jest)
- `GeoService.record`: country null → no-op; value<=0 → no-op; có country → upsert args đúng (kind, value, ngày UTC). (mock prisma + resolveCountry).
- Wiring per-action: khó unit-test end-to-end (nhiều module) → dựa `tsc` + đọc code; có thể thêm 1-2 test service mock kiểm `geo.record` được gọi đúng nhánh (vd toggleFavorite ADD gọi record; remove không gọi).
- Stats metric mở rộng: DTO chấp nhận kind mới (validation), service group đúng (đã có).
- Thủ công: favorite/comment/rating/gift/unlock/listen 1 truyện (IP giải được) → StoryCountryDaily có row đúng kind; `GET /stats/top-stories-by-country?country=..&metric=favorite` trả dữ liệu.

## 9. File dự kiến
- BE mới: `be/src/common/geo/geo.service.ts` + `geo.module.ts` (+test).
- BE sửa: user-features (controller+service: favorite + listen), chapter-comments (controller+service), reviews (controller+service), stories (controller+service: gift + unlock-story), chapters (controller+service: unlock-by-pulse; unlock-by-ad KHÔNG tính revenue) — mỗi module import GeoModule + thêm @Req + gọi geo.record. Stats: 3 geo DTO (mở rộng metric enum).
- (Tùy) chuyển `buildStoryCountryUpsertArgs` sang `geo.util.ts` để chia sẻ.

## 10. Ghi chú / follow-up
- **C**: UI admin — Top Truyện (cột top-5 quốc gia), Top Quốc gia (mọi metric), Xếp hạng theo quốc gia (mọi metric) — nay đủ dữ liệu 9 metric (view/search + 6 user-action; rating per-country = đếm).
- rating "chỉ đếm lần đầu", auth resolveCountry refactor, trust proxy prod, geoip DB update — follow-up.
- Không có prod migration mới cho B2b (dùng lại bảng story_country_daily của B2a — nhớ B2a migration vẫn cần deploy).
