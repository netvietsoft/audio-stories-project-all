# 04 — Database (Prisma + MySQL)

> MỤC ĐÍCH: Bản đồ toàn bộ schema dữ liệu của app audio-stories. Đây là **NGUỒN SỰ THẬT**
> khi cần đối chiếu trạng thái (status), loại truy cập (accessType), loại giao dịch...
> Trước khi so sánh chuỗi enum trong code, xem mục "DANH MỤC ENUM" bên dưới để dùng đúng giá trị.
>
> Nguồn đọc thật:
> - `be/prisma/schema.prisma` (~1173 dòng, datasource = MySQL, generator = prisma-client-js)
> - `be/prisma/seed.ts` (seed chính: roles, languages, users, categories, authors, stories+chapters, reviews, ads, music, system config)
> - `be/prisma/seed-music.ts` (seed riêng cho Music: singles, playlist, like, history)
> - `be/prisma/migrations/` (39 migration + `migration_lock.toml`)

TÌNH TRẠNG TỔNG: **done** (schema áp dụng qua migration đầy đủ; có dữ liệu seed chạy được).
CẢNH BÁO LỚN: schema để trong **một file duy nhất** ~1173 dòng → khó bảo trì, đề xuất tách (xem cuối file).

---

## 0. TỔNG QUAN NHANH

- **Provider**: MySQL. Hầu hết PK là `uuid()` `VarChar(36)`; vài bảng tra cứu (Role, Language, Category, Banner) dùng `autoincrement` `UnsignedInt`.
- **Quy ước cột**: code dùng camelCase, DB dùng snake_case qua `@map(...)`; mỗi model `@@map("ten_bang")`.
- **Soft delete**: chỉ một số model có `deletedAt` (User, Story, Chapter, ChapterVariant). Các model khác xoá cứng.
- **Đơn vị tiền tệ ảo "Pulse"**: trong code là `pulse*` nhưng cột DB vẫn tên cũ `credits*`
  (vd `User.pulseBalance @map("credits")`, `CreditTransaction.pulseAmount @map("amount")`,
  `MusicUnlock.pulseSpent @map("credits_spent")`). Đây là **đổi tên dở dang** (migration `unify_pulse`). Xem mục Cạm bẫy.
- Tổng cộng **~40 model** + **~20 enum**.

---

## 1. DANH MỤC ENUM (NGUỒN SỰ THẬT — đọc trước khi so sánh status)

> ⚠ Prisma enum trong MySQL phân biệt HOA/thường đúng như khai báo. Lưu ý có nhóm viết thường, nhóm viết HOA.

| Enum | Giá trị | Dùng ở |
|---|---|---|
| `AuthTokenType` | `VERIFY_EMAIL`, `VERIFY_CODE`, `PASSWORD_RESET` | `AuthToken.type` |
| `StoryStatus` | `ongoing`, `completed` | `Story.status` (mặc định `ongoing`) |
| `MusicContentType` | `single`, `podcast`, `playlist` | `Music.contentType` (mặc định `single`) |
| `MusicAccessType` | `free`, `vip` | `Music.accessType` (mặc định `free`) |
| `MusicUnlockSourceType` | `track`, `playlist` | `MusicUnlock.sourceType` (mặc định `track`) |
| `AdvertisementContentType` | `image`, `iframe`, `youtube` | `Advertisement.contentType` (mặc định `image`) |
| `ChapterAccessType` | `free`, `timed`, `vip`, `ads` | `Chapter.accessType` (mặc định `free`) |
| `ChapterUnlockType` | `VIP`, `TIMED`, `PULSE`, `AD` | `UserChapterUnlock.unlockType` |
| `CreditTransactionType` | `topup`, `spend`, `refund`, `admin_adjust` | `CreditTransaction.type` |
| `PaymentProvider` | `STRIPE`, `VIETQR`, `PAYPAL`, `MANUAL` | `Payment.provider` (mặc định `VIETQR`) |
| `PaymentStatus` | `PENDING`, `PROCESSING`, `SUCCESS`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED`, `REQUIRES_ACTION`, `REQUIRES_PAYMENT_METHOD` | `Payment.status` (mặc định `PENDING`) |
| `MembershipType` | `all_authors`, `specific_author` | `Membership.type` |
| `NotificationType` | `new_chapter`, `transaction`, `membership_expiry`, `system` | `Notification.type` |
| `SettingType` | `string`, `number`, `boolean`, `json` | `SiteSetting.type` (mặc định `string`) |
| `AudioReportType` | `broken_link`, `bad_quality`, `missing_audio`, `wrong_chapter`, `other` | `AudioReport.type` |
| `AudioReportStatus` | `pending`, `resolved`, `ignored` | `AudioReport.status` (mặc định `pending`) |
| `CommentReactionType` | `helpful`, `like`, `love` | `CommentReaction.type` |
| `CommentReportStatus` | `pending`, `reviewed`, `resolved`, `dismissed` | `CommentReport.status` (mặc định `pending`) |
| `SocialPlatform` | `facebook`, `telegram`, `zalo`, `instagram`, `twitter`, `reddit`, `discord`, `youtube`, `tiktok`, `other` | `SocialLink.platform` |

### ⚠ Enum LỖI / mơ hồ (cần lưu khi viết logic)
1. **`PaymentStatus` có CẢ `SUCCESS` lẫn `SUCCEEDED`** — hai giá trị nghĩa giống nhau (Stripe dùng `succeeded`, code nội bộ có thể dùng `SUCCESS`). Rất dễ so sánh thiếu một giá trị → coi đơn đã trả là chưa trả. PHẢI kiểm tra cả hai khi lọc "đã thanh toán".
2. **`ChapterAccessType` (free/timed/vip/`ads`) vs `ChapterUnlockType` (VIP/TIMED/PULSE/`AD`)** — hai enum song song mô tả gần như cùng khái niệm nhưng KHÁC casing và KHÁC tên (`ads` vs `AD`, không có `PULSE`/`free` ở enum kia). `accessType` = cách chương bị khoá; `unlockType` = cách user đã mở khoá. Đừng map 1-1 trực tiếp.
3. `MusicAccessType` chỉ có `free`/`vip` nhưng `Music` vẫn có `unlockPrice`/`discountPercit` (mở bằng Pulse) → trạng thái "mua bằng Pulse" KHÔNG nằm trong enum, suy ra từ `unlockPrice > 0`.

---

## 2. MODEL THEO DOMAIN

### 2.1. AUTH / USER
- **`User`** (`users`) — trung tâm, ~30 cột.
  - Định danh: `email` (unique), `googleId` (unique), `passwordHash` (nullable — cho OAuth-only).
  - Phân quyền: `roleId` (FK → Role, mặc định `4`).
    - ⚠ **CẠM BẪY**: mặc định `roleId = 4` nhưng seed chỉ tạo 2 role (`USER`, `ADMIN`) với id autoincrement 1,2. Nghĩa là user tạo mới (nếu code không set roleId) trỏ tới role **không tồn tại** → FK lỗi hoặc role rỗng. Phải kiểm tra service tạo user có set roleId rõ ràng.
  - Ví/VIP: `pulseBalance @map("credits")`, `vipTier` (TinyInt, mặc định 0), `vipExpirationDate`, `totalUnlockedStories`.
  - Thanh toán: `stripeCustomerId`, `paypalCustomerId` (đều unique).
  - Cờ thông báo: `allowEmailNoti`, `allowBellNoti`. Hồ sơ: `displayName`, `avatarUrl`, `country`.
  - Soft delete `deletedAt`; mốc thời gian `lastLoginAt`, `emailVerifiedAt`.
  - Quan hệ: ~30 quan hệ ngược (gần như mọi bảng giao dịch/tương tác đều trỏ về User).
  - Index: `roleId`, `isActive`, `totalUnlockedStories`, `vipTier`, `deletedAt`, `vipExpirationDate`.
- **`Role`** (`roles`) — `name`/`slug` unique, `permissions Json?` (RBAC động lưu JSON).
- **`OAuthAccount`** (`auth_oauth_account`) — liên kết provider ngoài; unique `[provider, providerUserId]`, có `profile Json?`.
- **`RefreshToken`** (`refresh_tokens`) — lưu **`jti`** (JWT ID) thay vì hash token (theo comment trong schema: chữ ký JWT đã đảm bảo integrity, jti chống replay). Có `expiresAt`.
- **`AuthToken`** (`auth_tokens`) — token verify email / reset password; `type` (AuthTokenType), `token` unique (512), `isUsed`, `expiresAt`.
- **`Author`** (`authors`) — `slug` unique, FK `languageId`, `followersCount` (đếm sẵn).

### 2.2. STORIES / CHAPTERS (nội dung truyện audio)
- **`Language`** (`languages`) — `key` unique (vd `vi`,`en`), `isActive`, `displayOrder`. Là gốc đa ngôn ngữ; Author/Category/Story/Chapter/Advertisement đều FK về đây.
- **`Category`** (`categories`) — unique `[slug, languageId]` (mỗi ngôn ngữ có bộ category riêng). N-N với Story qua `StoryCategory`.
- **`Story`** (`stories`) — unique `[slug, languageId]`.
  - Đếm sẵn (denormalized): `totalChapters`, `totalViews` (BigInt), `averageRating` (Decimal 3,2), `ratingCount`, `totalGifts`, `favoritesCount`.
  - Cờ hiển thị: `isFeatured`, `isRecommended`, `isInteractive`, `featuredOrder`.
  - Mở khoá: `unlockPrice`, `discountPercent` (mở cả truyện bằng Pulse → `UserStoryUnlock`).
  - `audioUrl` cấp truyện (?) — trùng vai trò với audio cấp chương; xem Cạm bẫy.
  - Soft delete `deletedAt`.
  - **Label (badge cover)**: `labelId Int? @map("label_id")` (FK → `Label`, `onDelete: SetNull`), `labelAssignedAt @map("label_assigned_at")`, `labelExpiresAt @map("label_expires_at")`. Mỗi truyện gán tối đa 1 label; hết hạn khi `now() > labelExpiresAt` (null = không hết hạn). Thêm bởi migration `20260709103611_add_labels_and_story_label` (cùng lúc tạo bảng `labels`). ⚠ `migration.sql` bị `.gitignore` chặn (`*.sql`) → prod cần tự chạy `prisma migrate deploy` (hoặc `ALTER TABLE` thủ công) để có cột/bảng này.
- **`Label`** (`labels`) — badge quản trị gắn cho truyện (global, KHÔNG theo ngôn ngữ). `id` (Int autoincrement UnsignedInt), `name` unique, `text` (chữ hiển thị trên badge), `color` (hex), `textColor?`, `icon?`, `defaultDurationDays?` (null/0 = không hết hạn), `createdAt`/`updatedAt`. Quan hệ ngược `stories Story[]`. Cùng migration `20260709103611_add_labels_and_story_label`.
- **`StoryViewDaily`** (`story_view_daily`) — bucket lượt xem theo ngày cho ranking global (metric `trending`, và nguồn tổng hợp thay cho quét `total_views` theo thời gian). `storyId`, `date` (Date), `views` (Int, default 0). `@@id([storyId, date])` (PK kép) + `@@index([date])`, FK `storyId → Story` (`onDelete: Cascade`). Được ghi bởi cron `flushTrackingCounters` (mỗi 5 phút) song song với việc tăng `stories.total_views`. Migration `20260709140000_add_story_view_daily`.
- **`StoryCountryDaily`** (`story_country_daily`) — bucket sự kiện theo quốc gia + ngày (chỉ IP phân giải được quốc gia mới có dòng; không ảnh hưởng số liệu global). `storyId`, `country` (Char(2), ISO upper), `date` (Date), `kind` (VarChar(10)), `count` (Int, default 0). `@@id([storyId, country, date, kind])` (PK kép 4 cột) + `@@index([kind, country])`, `@@index([kind, storyId])`, FK `storyId → Story` (`onDelete: Cascade`). Migration `20260709160000_add_story_country_daily`. **`kind` lưu 8 giá trị**: `view`/`search` (B2a) + `favorite`/`comment`/`rating`/`gift`/`revenue`/`listen` (B2b, chỉ thêm chuỗi — KHÔNG migration). Metric `trending` KHÔNG lưu, tính động từ `kind='view'` (decay 0.9 × 30 ngày) khi query (C).
- **`Chapter`** (`chapters`) — unique `[storyId, chapterNumber]`. `chapterNumber` là **Float** (cho phép chương 1.5).
  - `storyId` **nullable** (chương mồ côi?) → quan hệ Story `onDelete: Cascade` nhưng cột nullable, không nhất quán.
  - Nội dung: `content` (LongText), `audioUrl` / `r2AudioUrl` (Cloudflare R2) / `youtubeVideoId`, `audioDuration`.
  - Truy cập: `accessType` (ChapterAccessType), `unlockPrice`, `discountPercent`, `unlocksAt` (cho `timed`), `unlockAdId` (FK Advertisement, cho `ads`).
  - `isInteractive` + quan hệ `variants`/`incomingVariants` → cốt truyện phân nhánh.
  - `timingJson Json? @map("timing_json")` — dữ liệu **read-along** (khớp phụ đề/lời với nội dung chương), nullable
    (chương cũ không có timing vẫn không bị ảnh hưởng). Object dạng `{ v, cues, matched, total }`, mỗi cue trong
    `cues` có khoá `s`/`e`/`p`/`cs`/`ce`. Thêm bởi migration `20260708000000_add_chapter_timing_json`
    (`ALTER TABLE chapters ADD COLUMN timing_json JSON NULL`). ⚠ File `migration.sql` bị `.gitignore` chặn
    (`*.sql` ở root) nên KHÔNG được commit → prod cần tự thêm cột (chạy `prisma migrate deploy` hoặc `ALTER TABLE` thủ công) trước khi tính năng read-along hoạt động.
- **`ChapterVariant`** (`chapter_variants`) — nhánh cho chương tương tác.
  - Tự tham chiếu cây: `parentId` (relation `VariantHierarchy`, `onDelete: NoAction`), `nextChapterId` (FK Chapter), `nextVariantId` (**chỉ là cột thường, KHÔNG có relation** — xem Cạm bẫy).
  - `isDefault`, `orderIndex`, `unlockPrice`, audio riêng, soft delete `deletedAt`.

### 2.3. MUSIC (mảng nhạc, tách biệt với truyện)
- **`Music`** (`music_tracks`) — `slug` unique, `contentType` (single/podcast/playlist), `accessType` (free/vip).
  - **Playlist kiểu JSON**: khi `contentType=playlist`, danh sách track lưu ở `playlistTrackIds Json?` (mảng id). → đây là **CÁCH 1** để mô tả playlist.
  - Mở khoá: `originalUnlockPrice`, `unlockPrice`, `discountPercent`, `introEnabled`.
  - Đếm sẵn: `playCount`, `likeCount`, `commentCount`.
- **`MusicPlaylist`** (`music_playlists`) + **`MusicPlaylistTrack`** (`music_playlist_tracks`, PK kép `[playlistId, musicId]`, `orderIndex`) → playlist **quan hệ chuẩn hoá** của người dùng. Đây là **CÁCH 2** mô tả playlist.
  - ⚠ Hai cách mô tả playlist song song (JSON trong Music vs bảng quan hệ) → nguồn dữ liệu kép, dễ lệch. Xem Cạm bẫy.
- **`MusicComment`** (`music_comments`) — bình luận có cây (`parentId` self-relation `MusicCommentReplies`), `likeCount`.
- **`MusicCommentLike`** (`music_comment_likes`) — PK kép `[userId, commentId]`.
- **`MusicLike`** (`music_likes`) — unique `[userId, musicId]`.
- **`MusicHistory`** (`music_history`) — lịch sử nghe, `progressSeconds`, `listenedAt`.
- **`MusicUnlock`** (`music_unlocks`) — mở khoá nhạc bằng Pulse; unique `[userId, musicId]`; `sourceType` (track/playlist), `sourcePlaylistId` (FK Music, `onDelete: SetNull`), `pulseSpent @map("credits_spent")`.

### 2.4. BILLING / VÍ PULSE
- **`CreditTransaction`** (`credit_transactions`) — sổ cái biến động ví.
  - `type` (topup/spend/refund/admin_adjust), `pulseAmount @map("amount")`, `pulseBalanceBefore/After @map("balance_before/after")`, `referenceId` (id giao dịch nguồn — Payment/unlock...), `description`.
  - ⚠ KHÔNG có FK ràng buộc `referenceId` → không enforce toàn vẹn; tra cứu thủ công.
- **`Payment`** (`payments`) — nạp tiền.
  - `provider` (PaymentProvider), `status` (PaymentStatus), `packageCode`, `amountVnd`, `amountUsd` (Decimal), `pulseAdded @map("credits_added")`, `currency`.
  - VietQR: `qrData`, `qrImageBase64` (LongText), `transactionCode`, `bankTransactionId`.
  - Mốc: `paidAt`, `failedAt`, `expiresAt` (đơn QR có hạn). Unique `[provider, providerPaymentId]`.
- **`WebhookEvent`** (`webhook_events`) — idempotency cho webhook thanh toán; unique `[provider, eventId]`, `processed`, `retryCount`, `payload Json`.
- **`Membership`** (`memberships`) — gói đăng ký đọc.
  - `type` (all_authors/specific_author), `authorId` (nullable, cho gói theo tác giả, `onDelete: SetNull`), `startDate`/`endDate`, `pulseSpent @map("credits_spent")`.
  - Index tổ hợp `[userId, type, authorId, endDate]` để check membership còn hạn.

### 2.5. SOCIAL / ENGAGEMENT (tương tác người dùng)
- **`UserFavorite`** (`user_favorites`) — yêu thích truyện, PK kép `[userId, storyId]`.
- **`UserStorySubscription`** (`user_story_subscriptions`) — theo dõi truyện (nhận thông báo chương mới), PK kép.
- **`UserFollowAuthor`** (`user_follow_authors`) — theo dõi tác giả, PK kép.
- **`ListeningHistory`** (`listening_history`) — tiến độ nghe truyện; unique `[userId, chapterId, variantId]` (hỗ trợ nhánh tương tác), `progressSeconds`, `lastListenedAt`. `variantId` nullable FK ChapterVariant.
- **`Review`** (`reviews`) — đánh giá truyện; unique `[userId, storyId]`, `rating` (TinyInt), `likesCount`/`helpfulCount` đếm sẵn.
- **`ReviewLike`** / **`ReviewHelpful`** (`review_likes` / `review_helpful`) — PK kép `[userId, reviewId]`.
- **`ReviewReply`** (`review_replies`) — trả lời review, cây tự tham chiếu `parentId`.
- **`ChapterComment`** (`chapter_comments`) — bình luận chương (có thể gắn timestamp audio `timestampSeconds`); cây `parentId`, `isHidden`, FK tới Story+Chapter+Variant.
- **`CommentReaction`** (`comment_reactions`) — phản ứng bình luận; unique `[userId, commentId, type]` (CommentReactionType).
- **`CommentReport`** (`comment_reports`) — báo cáo bình luận; `status` (CommentReportStatus), `adminNote`.
- **`AudioReport`** (`audio_reports`) — báo lỗi audio chương; `type`/`status` (AudioReport*), `userId` nullable (`onDelete: SetNull` — cho phép báo cáo ẩn danh).
- **`Playlist`** / **`PlaylistItem`** (`playlists` / `playlist_items`) — playlist **chương truyện** của user (KHÁC `MusicPlaylist`). `totalItems` đếm sẵn, `orderIndex`.
- **Mở khoá nội dung truyện**:
  - **`UserStoryUnlock`** (`user_story_unlocks`) — mở cả truyện, unique `[userId, storyId]`, `pulseAmount`.
  - **`UserChapterUnlock`** (`user_chapter_unlocks`) — mở từng chương, unique `[userId, chapterId]`, `pulseAmount`, `unlockType` (ChapterUnlockType).
  - **`UserUnlockedVariant`** (`user_unlocked_variants`) — mở nhánh tương tác, PK kép `[userId, variantId]`.

### 2.6. SYSTEM / CMS / CONFIG
- **`SiteSetting`** (`site_settings`) — cấu hình kiểu key-value có type (`SettingType`) + description.
- **`SystemConfig`** (`system_configs`) — CŨNG là key-value config nhưng `value` String bắt buộc, KHÔNG có type/description.
  - ⚠ **Hai bảng config trùng vai trò** (SiteSetting vs SystemConfig). Seed dùng `SystemConfig` cho `ad_insertion_frequency`. Đề xuất gộp. Xem Cạm bẫy.
- **`Banner`** (`banners`, PK autoincrement Int) — banner CMS có lịch (`startDate`/`endDate`), `position`, `orderIndex`.
- **`HeroBanner`** (`hero_banners`, PK uuid) — banner trang chủ song ngữ (`titleVi/titleEn/subtitleVi/subtitleEn`), gắn `storyId` (nullable, `onDelete: SetNull`).
  - ⚠ **Hai bảng banner song song** (Banner vs HeroBanner), cấu trúc khác hẳn. Xem Cạm bẫy.
- **`Advertisement`** (`advertisements`) — quảng cáo.
  - `contentType` (image/iframe/youtube), `imageUrl`/`iframeCode`(LongText)/`youtubeId`+`youtubePlayTime`, `targetUrl`.
  - `routeType` (Int: 1=inline, 2=unlock-by-ad — comment trong schema), `isForcedRedirect`, `clickCount`.
  - `languageId` nullable + `isGlobal`. Quan hệ ngược `unlockedChapters` (Chapter mở khoá nhờ xem ad này).
- **`SocialLink`** (`social_links`) — link mạng xã hội footer; `platform` (SocialPlatform), `isActive`, `orderIndex`.

---

## 3. QUAN HỆ & RÀNG BUỘC CHÍNH

- **Trục User**: gần như mọi bảng giao dịch/tương tác `onDelete: Cascade` về User → xoá user là xoá sạch dữ liệu liên quan (trừ `AudioReport.userId`/`CommentReport.userId` = `SetNull`, giữ lại báo cáo ẩn danh).
- **Trục Story → Chapter → (Variant)**: Cascade từ Story xuống. Chapter ↔ ChapterVariant cây phân nhánh tương tác.
- **N-N**: Story↔Category (`StoryCategory`), Music↔Playlist user (`MusicPlaylistTrack`).
- **Đa ngôn ngữ**: mọi nội dung (Story/Chapter/Category/Author) gắn `languageId`; unique key thường kèm `languageId` (vd `[slug, languageId]`).
- **Index đáng chú ý** (phục vụ truy vấn nóng):
  - `Story`: `[status, isFeatured, publishedAt, updatedAt]`, `[isRecommended, updatedAt]`, `totalViews`, `averageRating`.
  - `Chapter`: `[storyId, chapterNumber(sort: Asc)]`, `accessType`, `unlocksAt`.
  - `Payment`: `[status, expiresAt]` (cho cron huỷ đơn QR quá hạn), `[userId, status]`.
  - `Membership`: `[userId, type, authorId, endDate]`, `endDate`.
  - `Notification`: `[userId, isRead, createdAt]`.
  - `Music`: theo `playCount`/`likeCount`/`commentCount`/`contentType` (ranking).

---

## 4. SEED DATA (be/prisma/seed.ts + seed-music.ts)

**`seed.ts`** (chạy tuần tự, dùng `upsert` để idempotent):
1. Roles: `USER`, `ADMIN`.
2. Languages: `vi` (Tiếng Việt), `en` (English).
3. Users: 1 admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD` env, mặc định `admin@truyen-audio.app` / `admin123`, hash argon2) + 6 demo reader (vip tier/pulse khác nhau).
4. Categories: 16 (8 cặp vi/en).
4b. Labels: 3 mặc định (Hot 7 ngày / New 14 ngày / Editor's Choice không hết hạn) — `upsert` theo `name`.
5. Authors: 5 (tên Hán-Việt, gắn ngôn ngữ vi).
6. Stories: ~88 (mỗi entry tạo cả bản vi + en), gồm 5 truyện tương tác (`isInteractive`).
   - Mỗi truyện thường: 15 chương; truyện tương tác: 1 chương + variant cây (Path A/B/C, A có sub-variant A.1/A.2).
   - accessType chương theo công thức: `ch%9==0 → vip`, `ch%4==0 → timed`, còn lại `free`.
7. Reviews: mỗi user review mọi story, rồi cập nhật `averageRating`/`ratingCount`.
8. User interactions: favorite, subscription, 1 listening history.
9. Advertisements: 5 (deleteMany rồi createMany).
10. Music: 6 track demo (deleteMany rồi createMany).
11. SystemConfig: `ad_insertion_frequency = 1000`.

**`seed-music.ts`** (chạy SAU seed chính, cần user tồn tại):
- 15 single + 3 playlist (kiểu JSON `playlistTrackIds`), like/history ngẫu nhiên, 2 playlist quan hệ của user.
- ⚠ Tạo dữ liệu Music CHỒNG lên 6 track của seed.ts (không xoá trước) → tổng Music = 6 + 15 + 3.

---

## 5. MIGRATIONS (be/prisma/migrations/ — 39 file)

Lịch sử migration phản ánh quá trình tiến hoá (theo thứ tự ngày trong tên thư mục):
- Billing & social ban đầu (03/2026): `add_billing_fields`, `add_notifications_reactions_reviews_support`, `add_review_helpful_and_replies`.
- Đa ngôn ngữ (03/2026): chuỗi `add_*_language`, `normalize_language_relations`, `add_languages_table`, `simplify_multilingual_columns` (nhiều lần thử nghiệm rồi đơn giản hoá → dấu hiệu thiết kế i18n thay đổi liên tục).
- Tương tác/Variants: `add_chapter_variants`, `add_parent_id_to_variants`.
- Quảng cáo: `add_ads`, `add_ad_route_unlock_ad`, `add_ads_to_chapters_access_type`, `add_ad_content_type_iframe`, `add_ad_content_type_youtube`, `add_ad_click_count`, `add_unlock_ad_youtube_forced_redirect`.
- Music: `add_music_social_features`, `add_music_content_type_playlist_fields`, `add_music_slug`, `add_music_history_progress_seconds`, `add_music_unlock_and_access_controls`, `add_music_discount_fields`.
- Auth: `replace_token_with_jti` (RefreshToken chuyển sang lưu jti).
- Tiền ảo: `unify_pulse` (đổi tên logic Credit→Pulse nhưng GIỮ tên cột cũ).
- Mở khoá: `add_user_chapter_unlocks`, `add_story_unlock_and_discounts`.
- Read-along: `add_chapter_timing_json` (thêm `chapters.timing_json`) — file `.sql` KHÔNG được commit (xem 2.2), cần tự áp dụng ở môi trường khác.
- Labels + Rankings (07/2026, sub-project A/B1/B2a/B2b/C): `20260709103611_add_labels_and_story_label` (bảng `labels` + `stories.label_id`/`label_assigned_at`/`label_expires_at`), `20260709140000_add_story_view_daily` (bảng `story_view_daily`), `20260709160000_add_story_country_daily` (bảng `story_country_daily`). Cả 3 file `.sql` đều KHÔNG được commit (cùng lý do `*.sql` ở `.gitignore`) → prod cần `prisma migrate deploy` (hoặc tạo bảng/cột thủ công) trước khi các tính năng này hoạt động. **B2b + C KHÔNG thêm migration** (B2b chỉ thêm giá trị chuỗi `kind`; C thêm trending tính động + UI admin).

`migration_lock.toml` khoá provider = mysql.

---

## 6. LỖI CẤU TRÚC / LOGIC PHÁT HIỆN (để refactor)

1. **Đổi tên Credit→Pulse dở dang**: code dùng `pulse*` nhưng cột DB còn `credits`/`amount`/`credits_spent`/`credits_added`/`balance_*`. Người đọc raw SQL/log dễ nhầm. → Nên migration đổi nốt tên cột (hoặc ghi chú rõ ở mọi chỗ).
2. **`PaymentStatus` thừa `SUCCESS` + `SUCCEEDED`**: rủi ro nghiệp vụ cao (lọc thiếu một giá trị = coi đơn đã trả là chưa trả). → Chuẩn hoá về 1 giá trị, migrate dữ liệu cũ.
3. **Hai enum trạng thái chương** (`ChapterAccessType` vs `ChapterUnlockType`) khác casing/giá trị → khó map. → Thống nhất quy ước.
4. **Hai bảng config** (`SiteSetting` vs `SystemConfig`) trùng vai trò → gộp làm một (giữ `SiteSetting` vì có type/description).
5. **Hai bảng banner** (`Banner` autoincrement vs `HeroBanner` uuid song ngữ) → vai trò chồng lấn, nên hợp nhất hoặc tài liệu hoá rõ ranh giới.
6. **Hai mô hình playlist nhạc** (`Music.playlistTrackIds` JSON vs `MusicPlaylist`/`MusicPlaylistTrack` quan hệ) → nguồn dữ liệu kép, dễ lệch thứ tự/nội dung. → Chọn một (ưu tiên bảng quan hệ).
7. **`Chapter.storyId` nullable** nhưng quan hệ `onDelete: Cascade` → mâu thuẫn ngữ nghĩa (chương mồ côi không rõ mục đích).
8. **`ChapterVariant.nextVariantId` chỉ là cột thường, không có relation/FK** (trong khi `nextChapterId` có FK) → mất ràng buộc toàn vẹn cho luồng nhánh tiếp theo.
9. **`CreditTransaction.referenceId` và `Notification.metadata`/`Payment.metadata` không ràng buộc FK** → tra cứu thủ công, không đảm bảo tồn tại bản ghi nguồn.
10. **`Story.audioUrl` cấp truyện** tồn tại song song audio cấp chương → vai trò không rõ, có thể là legacy.
11. **`User.roleId` mặc định 4** trong khi seed chỉ có role id 1,2 → user mặc định trỏ role không tồn tại (cần code luôn set roleId tường minh; nên sửa default = id role USER thực tế).
12. **Schema một file ~1173 dòng**: rất khó điều hướng. → ĐỀ XUẤT tách bằng Prisma `prismaSchemaFolder` (preview) hoặc multi-file: `auth.prisma`, `content.prisma`, `music.prisma`, `billing.prisma`, `engagement.prisma`, `system.prisma`.

---

## 7. PHẦN CÒN THIẾU / TODO

- Không có bảng "gift/tặng quà" dù `Story.totalGifts` đếm sẵn → tính năng gift chưa có bảng giao dịch (chỉ có counter).
- `MusicContentType.podcast` khai báo nhưng seed không tạo → kiểm tra service có dùng không.
- Không có audit log chung (chỉ `WebhookEvent` cho thanh toán). Hành động admin (sửa story, ẩn comment) không có lịch sử.
- Chưa thấy bảng/cột cho thông báo đẩy (push token) dù có `allowBellNoti`.
- `Advertisement.routeType` dùng Int magic number (1/2) thay vì enum → nên enum hoá.
