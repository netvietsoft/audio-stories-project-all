# 02 — BE: Stories + Chapters (truyện / chương / biến thể tương tác)

> Bản đồ vùng "nội dung truyện audio" của backend NestJS (audio-stories monorepo).
> Đọc CODE THẬT — cập nhật theo source ngày 2026-06-27.
> Phạm vi: `be/src/stories`, `be/src/chapters` (+ `chapter-variants`), `be/src/categories`, `be/src/authors`, `be/src/languages`.
> KHÔNG có global prefix `/api` (bootstrap.ts không gọi `setGlobalPrefix`). Route trong code = route thật. VD `@Controller('stories')` → `/stories`.

═══════════════════════════════════════════════════════════════════════
## 0. MÔ HÌNH DỮ LIỆU (nguồn sự thật: `be/prisma/schema.prisma`)
═══════════════════════════════════════════════════════════════════════

```
Language (id Int, key unique vd "vi"/"en", isActive, displayOrder)
   └─ 1-n Author, Category, Story, Chapter, Advertisement   (đều FK languageId)

Author (id UUID, name, slug unique, languageId, bio, followersCount)
   └─ 1-n Story

Category (id Int, name, slug, languageId; @@unique([slug, languageId]))
   └─ n-n Story  qua bảng nối StoryCategory(storyId, categoryId)

Story (id UUID, slug, title, languageId, authorId, status, totalChapters,
       totalViews BigInt, averageRating Decimal(3,2), isFeatured/featuredOrder,
       isRecommended, isInteractive, totalGifts, favoritesCount,
       unlockPrice, discountPercent, deletedAt[soft delete])
   ├─ 1-n Chapter (storyId NULLABLE → chương "mồ côi")
   └─ n-n Category

Chapter (id UUID, storyId NULLABLE, chapterNumber Float, title, languageId,
         content LongText, audioUrl, r2AudioUrl, youtubeVideoId, audioDuration,
         accessType[free/timed/vip/ads], unlockPrice, discountPercent,
         unlockAdId, isInteractive, unlocksAt, viewCount, deletedAt[soft delete])
   │   @@unique([storyId, chapterNumber])   ← chú ý: cấm trùng số chương trong 1 truyện
   └─ 1-n ChapterVariant (nhánh tương tác)

ChapterVariant (id UUID, chapterId, parentId[cây nhánh], nextChapterId,
                nextVariantId, title, content, audioUrl/r2AudioUrl,
                unlockPrice, orderIndex, isDefault, deletedAt[soft delete])

-- Bảng "sổ cái" mở khóa / quyền truy cập --
UserStoryUnlock     @@unique([userId, storyId])      mua nguyên truyện bằng Pulse
UserChapterUnlock   @@unique([userId, chapterId])    sổ cái mở chương; unlockType enum VIP/TIMED/PULSE/AD
UserUnlockedVariant @@id([userId, variantId])        mở 1 biến thể trả phí
```

ENUM quan trọng:
- `StoryStatus = ongoing | completed`
- `ChapterAccessType = free | timed | vip | ads`
- `ChapterUnlockType = VIP | TIMED | PULSE | AD` (ghi vào UserChapterUnlock.unlockType)

═══════════════════════════════════════════════════════════════════════
## 1. ACCESS TYPE & LUỒNG MỞ KHÓA (quan trọng nhất)
═══════════════════════════════════════════════════════════════════════

`Chapter.accessType` quyết định cách truy cập audio. Quy tắc thực thi nằm ở
`chapters.service.ts → getAudioUrl()` (chuẩn vàng) và `getUnlockStatus()`:

| accessType | Quy tắc truy cập |
|-----------|------------------|
| `free`  | Ai cũng nghe được (kể cả ẩn danh). |
| `timed` | Miễn phí SAU khi `unlocksAt <= now`. Trước đó: cần VIP hoặc đã mở. |
| `vip`   | Cần `vipTier > 0` và `vipExpirationDate` chưa hết hạn. |
| `ads`   | Mở bằng xem quảng cáo (`unlockByAd`). Lưu ý: data cũ có thể vẫn lưu `accessType='timed'` nhưng nhận biết qua `unlockAdId`. |

Thứ tự ưu tiên khi check quyền (xem `getUnlockStatus`):
1. `free` → unlocked (FREE)
2. `timed` đã tới hạn → unlocked (FREE, isTimedFree=true)
3. VIP hợp lệ → unlocked (VIP)
4. Đã mua nguyên truyện (UserStoryUnlock) → unlocked (PULSE_STORY)
5. Đã mở riêng chương (UserChapterUnlock) → unlocked (CHAPTER_<type>)
6. còn lại → locked

3 cách mở chương (đều ghi sổ cái UserChapterUnlock):
- **Pulse**: `POST /chapters/:id/unlock-by-pulse` → `unlockByPulse()`. Tính giá:
  `finalPrice = floor(unlockPrice * (100 - discountPercent) / 100)`. Trừ `pulseBalance`,
  ghi `CreditTransaction` (type='spend'), upsert UserChapterUnlock (PULSE). VIP/đã-mua-truyện → charged 0.
- **Quảng cáo**: `POST /chapters/:id/unlock-by-ad` → `unlockByAd()`. Validate ad active + khớp `unlockAdId`. Ẩn danh vẫn trả success nhưng không ghi sổ.
- **Mua nguyên truyện**: `POST /stories/:id/unlock` → `unlockStoryByPulse()`. 1 lần mở toàn bộ chương của truyện đó.

Mở **biến thể trả phí**: `POST /chapter-variants/:id/unlock` → `unlockVariant()`.
Trừ Pulse, ghi UserUnlockedVariant + CreditTransaction + upsert UserChapterUnlock — TẤT CẢ trong 1 `$transaction` (atomic, đúng).

CẠM BẪY giá tiền: chỉ `unlockByPulse` (chương) và `unlockStoryByPulse` áp `discountPercent`.
`unlockVariant` KHÔNG áp discount (dùng `variant.unlockPrice` thẳng) — bất nhất giữa các luồng.

═══════════════════════════════════════════════════════════════════════
## 2. AUDIO PROXY (entitlement-gated) — `GET /chapters/:id/audio`
═══════════════════════════════════════════════════════════════════════

- `audioUrl` / `r2AudioUrl` KHÔNG BAO GIỜ trả trong JSON public (xem các `select` trong
  `findAllByStory`, `findPublicDetail`, variant feed). Client BẮT BUỘC gọi proxy.
- `getAudioUrl()` kiểm tra quyền rồi **302 redirect** sang URL thật (ưu tiên r2AudioUrl > audioUrl;
  variant URL > chapter URL). Controller dùng `@HttpCode(302)` + `res.redirect`.
- Guard `OptionalJwtGuard` (cho phép ẩn danh; chỉ free/timed-đã-mở mới qua khi không đăng nhập).
- Ghi nhận lượt mở bằng `setImmediate(...)` fire-and-forget (lỗi tracking không được phá playback).
- Query `?variantId=` để lấy audio của 1 nhánh.

═══════════════════════════════════════════════════════════════════════
## 3. STORIES — `be/src/stories` (⚠ GOD-SERVICE)
═══════════════════════════════════════════════════════════════════════
File: `stories.controller.ts` (`@Controller('stories')`), `stories.service.ts` (~1100 dòng), `stories.module.ts`.

⚠ **`stories.service.ts` là "god-service"**: gánh quá nhiều trách nhiệm không thuộc về Story:
mở khóa truyện bằng Pulse, **tặng Pulse** (giftPulse), liệt kê **Categories**/**Authors** (trùng module
categories & authors), **Hall of Fame** (truy vấn `user` theo vipTier), Top Categories (groupBy storyCategory).
=> Nên tách: Payments/UnlockService, GiftService, đưa categories/authors list về đúng module.

### Endpoint (controller)
| Method | Route | Auth | Hàm service |
|--------|-------|------|-------------|
| POST | `/stories` | ADMIN | `create` |
| GET  | `/stories` | public | `exploreStories` |
| GET  | `/stories/admin` | ADMIN | `findAllAdmin` |
| GET  | `/stories/admin/:id` | ADMIN | `findOneAdmin` |
| GET  | `/stories/home` | public | `getHomeStories` (trending/newest/featured) |
| GET  | `/stories/categories` | public (cache 1h) | `getAllCategories` |
| GET  | `/stories/categories-with-count` | public | `getAllCategoriesWithCount` |
| GET  | `/stories/authors` | public | `getAllAuthors` |
| GET  | `/stories/explore` | public | `exploreStories` (alias của `/`) |
| GET  | `/stories/trending` | public | gọi `exploreStories({sort:'views'})` |
| GET  | `/stories/recommended` | public | `getRecommendedStories` (random hoá) |
| GET  | `/stories/categories/top` | public (cache 1h) | `getTopCategories` |
| GET  | `/stories/hall-of-fame` | public | `getHallOfFame` |
| PATCH| `/stories/:id/recommended` | ADMIN | `updateRecommended` |
| PATCH| `/stories/:id` | ADMIN | `updateStory` |
| DELETE | `/stories/:id` | ADMIN | `deleteStory` (soft delete) |
| POST | `/stories/:id/gift` | user | `giftPulse` |
| POST | `/stories/:id/unlock` | user | `unlockStoryByPulse` |
| GET  | `/stories/:slug` | public | `getStoryDetail` (PHẢI là route cuối — catch-all theo slug) |

### Logic đáng chú ý
- **Cache explore**: kiểu "version key" thủ công (`stories:explore:version`, TTL 60s). Mỗi lần
  create/update/delete/gift/recommend gọi `invalidateExploreCache()` (đổi version → cache cũ bị bỏ).
  Cache key = JSON các query đã chuẩn hoá. (`exploreStories` tự cache, KHÁC với `CacheInterceptor` của Nest).
- **`exploreStories`**: lọc theo lang/status/search(title|author)/categoryId/authorId/trendWindow/isInteractive/isRecommended.
  Sort: latest|views|rating|title_asc|chapters_desc|gifts|favorites. Tính `totalBranches` = tổng số variant của các chương.
- **`serializeStory`**: ép `totalViews` BigInt → Number; làm phẳng `language` object `{key}` → string.
- **`create`**: nhận `chapters` (nested create), `chapterIds` (gán chương có sẵn qua updateMany),
  `categoryIds` (nested create StoryCategory). Bắt P2002 (trùng slug) → 400.
- **`giftPulse`**: trừ Pulse user, `totalGifts += amount` trên story, ghi CreditTransaction.
- **`getHallOfFame`**: truy vấn User (vipTier>0) — KHÔNG liên quan story, đặt sai chỗ.

### TÌNH TRẠNG: **done** (chạy được, đủ tính năng public + admin CRUD).

═══════════════════════════════════════════════════════════════════════
## 4. CHAPTERS — `be/src/chapters`
═══════════════════════════════════════════════════════════════════════
File: `chapters.controller.ts` (`@Controller()` rỗng — route tự khai báo full path), `chapters.service.ts`, `chapters.module.ts` (import UserFeaturesModule + ChapterVariantsModule).

### Endpoint
| Method | Route | Auth | Hàm |
|--------|-------|------|-----|
| GET  | `/stories/:storyId/chapters` | ADMIN | `findAllByStory` |
| POST | `/stories/:storyId/chapters` | ADMIN | `create` (gắn vào story) |
| POST | `/chapters` | ADMIN | `createStandalone` (storyId optional → chương mồ côi) |
| GET  | `/chapters/latest` | public (`@Public`) | `findLatest` (clamp limit ≤ 50) |
| GET  | `/chapters` | ADMIN | `findAllGlobal` (filter, `storyId='null'` → chương mồ côi) |
| GET  | `/chapters/:id/public` | public | `findPublicDetail` (kèm variants, KHÔNG kèm audioUrl) |
| GET  | `/chapters/:id/unlock-status` | optional JWT | `getUnlockStatus` |
| GET  | `/chapters/:id/audio` | optional JWT, 302 | `getAudioUrl` |
| POST | `/chapters/:id/unlock-by-ad` | optional JWT | `unlockByAd` |
| POST | `/chapters/:id/unlock-by-pulse` | user | `unlockByPulse` |
| GET  | `/chapters/:id` | ADMIN | `findOne` |
| PATCH| `/chapters/:id` | ADMIN | `update` |
| DELETE | `/chapters/:id` | ADMIN | `remove` (soft delete) |

### Logic đáng chú ý
- **`totalChapters` đếm thủ công**: create `+1`, remove `-1`, đổi storyId thì `-1` story cũ `+1` story mới — đều trong `$transaction`. Dễ lệch nếu có thao tác ngoài luồng (vd `story.create` với nested chapters cũng tự set totalChapters). Không có cron đối soát.
- **Đổi storyId khi update**: tự tính `chapterNumber` mới = max(chapterNumber của story đích) + 1 để tránh đụng `@@unique([storyId, chapterNumber])`.
- **`notifyStoryUpdated`**: gọi UserFeaturesService báo "new_chapter"/"chapter_updated" (thông báo người theo dõi). Chỉ bắn khi có storyId.
- **Soft delete**: lọc `deletedAt: null` ở mọi truy vấn đọc.

### TÌNH TRẠNG: **done**.

═══════════════════════════════════════════════════════════════════════
## 5. CHAPTER VARIANTS (truyện tương tác / interactive) — `be/src/chapters/chapter-variants`
═══════════════════════════════════════════════════════════════════════
File: `chapter-variants.controller.ts`, `chapter-variants.service.ts`, `chapter-variants.module.ts`.

Mô hình "chọn nhánh": mỗi Chapter có nhiều ChapterVariant tạo thành CÂY qua `parentId`;
chuyển tiếp giữa các nhánh/chương qua `nextChapterId` / `nextVariantId`. `isDefault` đánh dấu nhánh mặc định, `orderIndex` để sắp xếp lựa chọn.

### Endpoint
| Method | Route | Auth | Hàm |
|--------|-------|------|-----|
| GET  | `/chapters/:chapterId/variants` | optional JWT | `findAllByChapter` (lọc `parentId`; `parentId='null'` → gốc) |
| GET  | `/chapter-variants/:id` | ADMIN | `findOne` |
| POST | `/chapter-variants` | ADMIN | `create` |
| PATCH| `/chapter-variants/:id` | ADMIN | `update` |
| DELETE | `/chapter-variants/:id` | ADMIN | `remove` (soft delete) |
| POST | `/chapter-variants/:id/unlock` | user | `unlockVariant` |
| GET  | `/chapters/:chapterId/unlocked-variants` | user | `getUnlockedVariants` (trả mảng variantId) |

### Logic đáng chú ý
- **`findAllByChapter` masking**: với variant `unlockPrice > 0` mà user CHƯA mở và KHÔNG VIP →
  trả về variant nhưng `content/audioUrl/r2AudioUrl = null` (admin thấy hết). Đây là lớp bảo vệ nội dung trả phí ở feed.
- **`unlockVariant`** atomic (xem mục 1). KHÔNG áp discountPercent.

### TÌNH TRẠNG: **done** (đủ CRUD + unlock). Thiếu kiểm tra chống chu trình (cycle) trong cây nhánh.

═══════════════════════════════════════════════════════════════════════
## 6. CATEGORIES — `be/src/categories`
═══════════════════════════════════════════════════════════════════════
File: `categories.controller.ts` (`@Controller('categories')`), `categories.service.ts`.

| Method | Route | Auth | Hàm |
|--------|-------|------|-----|
| GET  | `/categories` | public (CacheInterceptor 1h, key `categories:all`) | `findAll` |
| GET  | `/categories/:id` | public | `findOne` |
| POST | `/categories` | ADMIN | `create` |
| PATCH| `/categories/:id` | ADMIN | `update` |
| DELETE | `/categories/:id` | ADMIN | `remove` (HARD delete) |
| DELETE | `/categories/bulk/delete` | ADMIN | `bulkRemove` |

- `findAll` mặc định lọc `language.key='vi'`, hỗ trợ search name|slug, phân trang, kèm `_count.stories`.
- `mapCategoryLanguage` làm phẳng language → key.
- ⚠ CẠM BẪY: `@CacheKey('categories:all')` cố định → cache KHÔNG phân biệt theo query (language/search/page).
  Truy vấn lần đầu được cache, các query khác sẽ nhận sai data trong 1h. (Lỗi cấu trúc cache.)
- ⚠ `remove`/`bulkRemove` là **hard delete** (`prisma.delete`), không soft delete. Có FK StoryCategory → có thể lỗi ràng buộc nếu category đang gắn truyện.

### TÌNH TRẠNG: **done** nhưng có lỗi cache key + hard delete (cần refactor).

═══════════════════════════════════════════════════════════════════════
## 7. AUTHORS — `be/src/authors`
═══════════════════════════════════════════════════════════════════════
File: `authors.controller.ts` (`@Controller('authors')`), `authors.service.ts`.

| Method | Route | Auth | Hàm |
|--------|-------|------|-----|
| GET  | `/authors` | public | `findAll` (kèm `_count.stories`) |
| GET  | `/authors/:id` | public | `findOne` |
| POST | `/authors` | ADMIN | `create` |
| PATCH| `/authors/:id` | ADMIN | `update` |
| DELETE | `/authors/:id` | ADMIN | `remove` (HARD delete) |

- Làm phẳng language → key. `create`/`update` connect Language theo key (mặc định 'vi').
- ⚠ Author KHÔNG có `deletedAt` trong schema → chỉ hard delete. Story.authorId là FK bắt buộc → xoá author đang có truyện sẽ lỗi ràng buộc khoá ngoại.
- ⚠ TRÙNG LẶP: list authors còn được phục vụ bởi `GET /stories/authors` (god-service). 2 nguồn cho cùng dữ liệu.

### TÌNH TRẠNG: **done**.

═══════════════════════════════════════════════════════════════════════
## 8. LANGUAGES — `be/src/languages`
═══════════════════════════════════════════════════════════════════════
File: `languages.controller.ts` (`@Controller('languages')`), `languages.service.ts`.

| Method | Route | Auth | Hàm |
|--------|-------|------|-----|
| GET  | `/languages` | public | `findAll` (filter active/search, `all=true` bỏ phân trang) |
| GET  | `/languages/:id` | public | `findOne` |
| POST | `/languages` | ADMIN | `create` (key normalize lowercase, unique → 409) |
| PATCH| `/languages/:id` | ADMIN | `update` |
| DELETE | `/languages/:id` | ADMIN | `remove` (HARD delete) |

- `key` là khoá nghiệp vụ (vd "vi","en"); mọi module khác connect Language qua `key`.
- ⚠ Hard delete Language sẽ phá FK của Story/Chapter/Author/Category (languageId NOT NULL). Không có chặn.

### TÌNH TRẠNG: **done**.

═══════════════════════════════════════════════════════════════════════
## 9. LỖI CẤU TRÚC / LOGIC TỔNG HỢP (để refactor)
═══════════════════════════════════════════════════════════════════════
1. **God-service `stories.service.ts`**: ôm unlock/gift/hall-of-fame/categories/authors. Cần tách service riêng.
2. **Trùng endpoint**: `/stories/categories`, `/stories/authors` trùng chức năng module categories/authors.
   Còn `/stories` và `/stories/explore` là alias hệt nhau.
3. **Cache categories sai key**: `@CacheKey('categories:all')` không gồm query → trả nhầm theo ngôn ngữ/trang.
4. **Bất nhất discount**: variant unlock không áp discountPercent, story/chapter thì có.
5. **`totalChapters` đếm tay**, nhiều nơi tăng/giảm, không có đối soát → dễ lệch.
6. **Hard delete** ở categories/authors/languages trong khi stories/chapters/variants dùng soft delete → mô hình xoá không nhất quán; rủi ro vỡ FK.
7. **`accessType='ads'` không nhất quán với data cũ** (`unlockByAd` phải fallback nhận diện qua `unlockAdId`).
8. **Lạm dụng `as any`** ở select/where trong stories.service (mất type-safety của Prisma).
9. **`console.log` rải rác** trong chapters.service/stories.service (giftPulse, create, update) — nên thay bằng Logger.
10. **Cây variant không chống cycle** (parentId/nextVariantId tự tham chiếu) — admin nhập sai có thể tạo vòng lặp.

═══════════════════════════════════════════════════════════════════════
## 10. PHẦN CÒN THIẾU / TODO
═══════════════════════════════════════════════════════════════════════
- Chưa thấy tăng `totalViews` / `viewCount` ở vùng này (có thể nằm ở user-features/listening-history — cần xác minh).
- `averageRating`/`ratingCount` chỉ đọc, không thấy nơi cập nhật trong vùng này (rating module riêng?).
- Không có validate chống xoá Language/Author/Category đang được tham chiếu.
- Không có Swagger DTO mô tả response (chỉ DTO input). 
- Không có test cho các luồng unlock (Pulse/Ad/VIP/timed).
- `discountPercent` chưa thống nhất áp dụng (variant bỏ sót).
