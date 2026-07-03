# 🎵 BE — Music & Tương tác xã hội

> VÙNG NÀY: Nhạc (single/podcast/playlist), mở khoá VIP bằng Pulse, like/lịch sử/yêu thích,
> playlist cá nhân, bình luận nhạc, đánh giá truyện (reviews/ratings), bình luận chương
> (chapter-comments) + reactions/reports, và module quản trị comments.
> Đọc code thật tại `be/src/music`, `be/src/personal-playlist`, `be/src/reviews`,
> `be/src/comments`, `be/src/chapter-comments`.
> Cập nhật: 2026-06-27 (đọc code thật).

---

## 0. LƯU Ý CHUNG (đọc trước)

- **KHÔNG có global prefix `/api`.** `be/src/main.ts` không gọi `setGlobalPrefix`, nên route
  trong code chính là route thật: `@Controller('music')` → `GET /music`. (Khác với dự án CRM
  trong `first_readme.txt` — đừng thêm `/api`.)
- **Auth:** dùng `JwtAccessGuard` (`@/auth/guards/jwt-access.guard`) + decorator `@Account()`
  để lấy user. Mọi service đọc id qua helper `userIdFromAccount(account) = account?.id || account?.sub`
  (lặp lại ở mọi controller — xem mục Lỗi cấu trúc).
- **Phân quyền admin:** `RolesGuard` + `@Roles('ADMIN')`.
- **`PrismaModule` là `@Global()`** (`be/src/prisma/prisma.module.ts`) → các module không cần
  import vẫn dùng được Prisma (vd `PersonalPlaylistModule` không import PrismaModule).
- **Tiền tệ ảo = "Pulse"** lưu ở `User.pulseBalance`; mọi giao dịch ghi `CreditTransaction`
  (`type: 'spend'`, `pulseAmount` âm). Đây là điểm nối quan trọng giữa music và ví người dùng.

---

## 1. MUSIC — catalog nhạc (single / podcast / playlist)

### Mục đích
Quản lý kho audio dạng "nhạc/podcast" tách biệt với "truyện" (Story). 3 loại nội dung
(`MusicContentType`): `single`, `podcast`, `playlist`. Playlist KHÔNG có file audio riêng —
nó tham chiếu danh sách id của các track single/podcast.

### File chính
- `be/src/music/music.controller.ts` — CRUD + public read + play count. Upload đa file
  (`audioFile`, `thumbnailFile`) qua `FileFieldsInterceptor` (memoryStorage, giới hạn 120MB/file).
- `be/src/music/music.service.ts` — **GOD-SERVICE** (~940 dòng), chứa toàn bộ logic catalog,
  pricing, slug, playlist enrichment.
- `be/src/music/dto/create-music.dto.ts`, `update-music.dto.ts`, `music-query.dto.ts`.
- Schema: model `Music` (`be/prisma/schema.prisma:327`, bảng `music_tracks`).

### Model `Music` (các cột đáng nhớ)
- `contentType` (`single|podcast|playlist`), `accessType` (`free|vip`).
- Pricing: `originalUnlockPrice` (giá gốc, null nếu free), `discountPercent` (0–99),
  `unlockPrice` (giá sau giảm — **giá trị thực dùng để trừ Pulse**).
- `playlistTrackIds` (Json mảng id, CHỈ dùng khi `contentType=playlist`).
- Bộ đếm denormalized: `playCount`, `likeCount`, `commentCount` (cập nhật thủ công, xem cảnh báo).
- `tags` (Json mảng string), `introEnabled` (bật đoạn intro nghe thử), `isPublic`.

### Endpoint (controller `MusicController`)
| Method | Route | Quyền | Logic |
|---|---|---|---|
| GET | `/music` | public | `findPublic` → `findByQuery(onlyPublic=true)`. Lọc `isPublic`, `contentType`, `search` (title/artist/description `contains`), `tag` (lọc trong app, không phải DB). **Ẩn track con của playlist** khỏi danh sách (xem cảnh báo). Phân trang. |
| GET | `/music/admin` | ADMIN | `findAllAdmin` → `findByQuery(onlyPublic=false)`, không ẩn track con. |
| GET | `/music/:slug/related` | public | `findRelatedPublic` — lấy tối đa 120 ứng viên, ưu tiên cùng artist → cùng tag → fallback, cắt theo limit (1–20, mặc định 8). |
| GET | `/music/:slug` | public | `findOnePublic` — chỉ track `isPublic`, kèm enrich playlistTracks. |
| POST | `/music/:id/play` | public | `incrementPlayCount` — +1 `playCount` (không auth → ai cũng bơm được, xem cảnh báo). |
| POST | `/music` | ADMIN | `create` (multipart). |
| PATCH | `/music/:id` | ADMIN | `update` (multipart, partial). |
| DELETE | `/music/:id` | ADMIN | `remove`. |

### Pricing — logic cốt lõi (`resolveMusicPricing`, service)
- `accessType=free` → mọi giá = 0, `originalUnlockPrice=null`.
- `accessType=vip` → bắt buộc có giá > 0. `unlockPrice = computeDiscountedPrice(original, discountPercent)`
  = `floor(original * (100 - discount) / 100)`, tối thiểu 1.
- `discountPercent` phải là số nguyên 0–99 (`normalizeDiscountPercent`).
- Khi update mà không gửi field giá → giữ nguyên (có nhánh `fallback`).

### Playlist — cách hoạt động
- Tạo playlist: bắt buộc `playlistTrackIds` (mảng id của single/podcast). Service gọi
  `resolvePlaylistTracks` để xác minh tất cả id tồn tại và đúng loại (single/podcast),
  nếu thiếu/sai loại → `BadRequestException`.
- `audioUrl` của playlist = audioUrl của track đầu tiên; `audioDuration` = tổng duration các track;
  thumbnail = upload hoặc thumbnail track đầu.
- `playlistTrackAccess` (tuỳ chọn): ghi đè accessType/unlockPrice cho TỪNG track con khi tạo/sửa
  playlist (`applyPlaylistTrackAccessConfig`, chạy trong transaction). Lưu ý: nó **ghi đè trực tiếp
  vào bản ghi Music của track con** (set `discountPercent=0`), ảnh hưởng cả khi track đó đứng độc lập.
- Khi đọc (`enrichPlaylistTracks`): với row playlist, nạp chi tiết các track con (theo
  `playlistTrackIds`) và đính kèm `playlistTracks[]`.

### Slug
`generateUniqueSlug` — bỏ dấu tiếng Việt, `đ→d`, kebab-case; nếu trùng thì thêm hậu tố `-2`, `-3`…
(vòng lặp query từng candidate — N+1 truy vấn khi nhiều trùng lặp).

### TÌNH TRẠNG: **done** (CRUD + playlist + pricing đầy đủ, đang chạy).

### LỖI CẤU TRÚC / CẠM BẪY
- ⚠ **`playCount` không auth** (`POST /music/:id/play`) → có thể spam tăng lượt nghe.
- ⚠ **Ẩn track con của playlist trong list công khai** (`listPlaylistChildTrackIds` +
  `findByQuery`): mỗi lần list phải quét toàn bộ playlist công khai để gom `playlistTrackIds`
  → O(playlist) query mỗi request, và logic `notIn` phức tạp (3 nhánh theo contentType).
- ⚠ **Lọc theo `tag` làm trong application** (`findByQuery` nhánh `normalizedTag`): tải TẤT CẢ
  row khớp where rồi filter + phân trang trong RAM → không scale.
- ⚠ **`playlistTrackAccess` ghi đè bản ghi gốc của track con** → side-effect ngoài ý muốn nếu
  track con cũng bán riêng.
- ⚠ Bộ đếm `likeCount`/`commentCount`/`playCount` denormalized, cập nhật thủ công ở nhiều service
  → dễ lệch (xem mục comments/like bên dưới).
- ⚠ `generateUniqueSlug` N+1 khi đụng trùng slug.

---

## 2. MUSIC INTERACTIONS — like / lịch sử / mở khoá / yêu thích

### Mục đích
Tương tác của user đã đăng nhập với 1 track: like, lưu lịch sử nghe (+ tiến độ), mở khoá VIP
bằng Pulse, kiểm tra quyền truy cập (accessType), liệt kê lịch sử/đã mở khoá/yêu thích.

### File chính
- `be/src/music/music-interaction.controller.ts` — `@Controller('music/interactions')`,
  toàn bộ guard `JwtAccessGuard` ở cấp class.
- `be/src/music/music-interaction.service.ts` — logic access/unlock/like/history/favorites.
- DTO: `update-music-history-progress.dto.ts`, `list-music-history.dto.ts`, `list-music-favorites.dto.ts`.
- Schema: `MusicLike` (`:404`), `MusicHistory` (`:419`), `MusicUnlock` (`:440`),
  enum `MusicUnlockSourceType` (`track|playlist`, `:435`).

### Endpoint (mọi route cần đăng nhập)
| Method | Route | Logic |
|---|---|---|
| GET | `/music/interactions/:musicId/liked` | trạng thái đã like chưa |
| POST | `/music/interactions/:musicId/like` | like (idempotent) + `likeCount++` |
| DELETE | `/music/interactions/:musicId/like` | unlike + `likeCount--` (sàn 0) |
| POST | `/music/interactions/:musicId/history` | tạo/cập nhật entry lịch sử (đẩy `listenedAt`) |
| PATCH | `/music/interactions/:musicId/history` | cập nhật `progressSeconds` (giây nghe) |
| GET | `/music/interactions/:musicId/access` | `getAccessStatus` — trả `unlocked/canPlay/unlockPrice/unlockSource` |
| POST | `/music/interactions/:musicId/unlock` | `unlockMusic` — trừ Pulse, ghi `MusicUnlock` + `CreditTransaction` |
| GET | `/music/interactions/history` | danh sách lịch sử (phân trang, kèm music) |
| GET | `/music/interactions/unlocked` | danh sách đã mở khoá |
| DELETE | `/music/interactions/history/:id` | xoá 1 entry |
| DELETE | `/music/interactions/history` | xoá toàn bộ lịch sử |
| GET | `/music/interactions/favorites` | danh sách đã like (phân trang) |

### Access / Unlock — logic cốt lõi (`getPlayableState`, `unlockMusic`)
- Track `free` hoặc `unlockPrice<=0` → luôn `unlocked`, `unlockSource='free'`.
- Track VIP: kiểm tra theo thứ tự:
  1. **Direct unlock**: có `MusicUnlock(userId, musicId)` → unlocked (source = sourceType đã lưu).
  2. (Track lẻ) **Playlist unlock**: nếu track nằm trong 1 playlist mà user đã mở khoá cả playlist
     (`findPlaylistUnlockForTrack`) → unlocked, source `playlist`.
  3. (Playlist) tính **giá còn lại** = `unlockPrice - tổng unlockPrice các track con VIP user đã mở`
     (`calculateDiscountedPlaylistUnlockPrice`). Nếu còn lại ≤ 0 → coi như đã mở; ngược lại
     phải mở khoá playlist trực tiếp.
- `unlockMusic`: nếu chưa unlocked → mở transaction: kiểm tra `pulseBalance >= chargedPulse`
  (nếu thiếu → `Insufficient Pulse`), trừ Pulse, **upsert `MusicUnlock` cho cả playlist VÀ tất cả
  track con** (nếu là playlist), ghi `CreditTransaction(type=spend, pulseAmount=-chargedPulse)`.
  Chỉ bản ghi unlock của chính track/playlist được mua mới ghi `pulseSpent`; track con ghi 0.

### TÌNH TRẠNG: **done** (unlock + ví Pulse hoạt động, có transaction).

### LỖI CẤU TRÚC / CẠM BẪY
- ⚠ **`findPlaylistUnlockForTrack` quét TẤT CẢ playlist** (mọi user) rồi lọc trong app để tìm
  playlist chứa track → O(toàn bộ playlist) mỗi lần check access track lẻ. Không scale.
- ⚠ **`calculateDiscountedPlaylistUnlockPrice` không kiểm `chargedPulse` theo giá đã giảm khi mua
  lại**: `unlockMusic` charge `state.unlockPrice` (đã là giá còn lại) — ổn, nhưng giá này tính ở
  `getPlayableState` rồi tính LẠI ngầm; cần để ý nếu sửa.
- ⚠ Like/unlike dùng transaction nhưng `unlike` đọc-rồi-ghi `likeCount` (race condition khi
  đồng thời). `like` dùng `increment` an toàn hơn `unlike` (dùng giá trị đọc trước đó).
- ⚠ `getPlayableState` chỉ chặn `isPublic=false` ⇒ track ẩn không xem được access, nhưng nếu đã
  có unlock cũ thì vẫn không play được (đúng nghiệp vụ, nhưng cần biết).
- ⚠ `updateHistoryProgress`/`addHistory` dùng `findFirst orderBy listenedAt desc` rồi update —
  có thể tạo nhiều bản ghi history cho cùng (user,music) nếu gọi song song (không có unique).

---

## 3. MUSIC COMMENTS — bình luận trên track nhạc

### Mục đích
Bình luận 1 cấp lồng nhau (comment + reply) cho từng track; like comment.

### File chính
- `be/src/music/music-comment.controller.ts` — `@Controller('music')` (lưu ý: chung prefix
  với `MusicController`!), một số route public, route ghi cần auth.
- `be/src/music/music-comment.service.ts`.
- Schema: `MusicComment` (`:367`, self-relation `MusicCommentReplies`), `MusicCommentLike` (`:390`).

### Endpoint
| Method | Route | Quyền | Logic |
|---|---|---|---|
| GET | `/music/:musicId/comments` | public | list comment gốc (parentId=null) + tối đa 50 reply mỗi comment; sort `newest|oldest`; phân trang. |
| POST | `/music/:musicId/comments` | auth | tạo comment gốc + `Music.commentCount++`. |
| POST | `/music/comments/:commentId/reply` | auth | reply; **ép 1 cấp**: nếu parent đã là reply thì gắn vào root (`parent.parentId || parent.id`). +commentCount. |
| POST | `/music/comments/:commentId/like` | auth | like comment (idempotent) + `likeCount++`. |
| DELETE | `/music/comments/:commentId/like` | auth | unlike + `likeCount--`. |
| PATCH | `/music/comments/:commentId` | auth | sửa (chỉ chủ comment). |
| DELETE | `/music/comments/:commentId` | auth | xoá (chỉ chủ); giảm `commentCount` theo (1 + số reply con) — cascade DB xoá reply. |

### TÌNH TRẠNG: **done**.

### LỖI CẤU TRÚC / CẠM BẪY
- ⚠ **2 controller cùng prefix `music`** (`MusicController` và `MusicCommentController`) →
  route phải đảm bảo không đụng nhau; `:slug` (MusicController) và `:musicId/comments`
  (MusicCommentController) cùng namespace — hiện ổn nhờ path khác nhau, nhưng dễ nhầm khi thêm route.
- ⚠ **Validation content sơ sài**: chỉ `trim()` rồi check rỗng (ném `ForbiddenException` —
  sai mã lỗi, nên là `BadRequest`). Không giới hạn độ dài content ở music comment.
- ⚠ `deleteComment` tính lại `commentCount` bằng đọc-trừ (race). Số reply lấy từ `_count.children`
  chỉ đếm con TRỰC TIẾP (do ép 1 cấp nên ổn).
- ⚠ `unlikeComment` dùng `decrement` không sàn 0 (có thể âm nếu dữ liệu lệch).

---

## 4. PERSONAL PLAYLIST — playlist cá nhân của user

### Mục đích
Playlist do CHÍNH user tạo (khác với playlist trong catalog Music). Lưu danh sách track có thứ tự.

### File chính
- `be/src/personal-playlist/personal-playlist.controller.ts` — `@Controller('personal-playlists')`,
  guard `JwtAccessGuard` cấp class.
- `be/src/personal-playlist/personal-playlist.service.ts`.
- Schema: `MusicPlaylist` (`:460`), `MusicPlaylistTrack` (`:477`, PK kép `[playlistId, musicId]`,
  có `orderIndex`).

### Endpoint (đều cần đăng nhập, scope theo owner)
| Method | Route | Logic |
|---|---|---|
| POST | `/personal-playlists` | tạo (title bắt buộc; coverImage mặc định `/thumbnaildefault.jpg`) |
| GET | `/personal-playlists` | list của tôi (kèm `totalTracks`) |
| GET | `/personal-playlists/:id` | chi tiết + tracks (sort `orderIndex` asc) + music |
| PATCH | `/personal-playlists/:id` | đổi title |
| POST | `/personal-playlists/:id/tracks/:musicId` | thêm track (chỉ music `isPublic`); idempotent; `orderIndex = max+1` |
| DELETE | `/personal-playlists/:id/tracks/:musicId` | gỡ track |
| DELETE | `/personal-playlists/:id` | xoá playlist (cascade tracks) |

### TÌNH TRẠNG: **done**.

### LỖI CẤU TRÚC / CẠM BẪY
- ⚠ **`MusicPlaylist.isPublic` tồn tại trong schema nhưng KHÔNG có endpoint chia sẻ công khai** —
  không có route đọc playlist của user khác → tính năng "playlist công khai" còn THIẾU (stub schema).
- ⚠ `ensureOwnedPlaylist` chạy trước mọi thao tác (tốt), nhưng `addTrack` đếm `totalTracks` bằng
  query riêng sau transaction (thêm 1 round-trip).
- ⚠ `coverImage` mặc định hard-code `/thumbnaildefault.jpg` (đường dẫn FE) trong BE — coupling FE/BE.
- ⚠ Khi gỡ track không nén lại `orderIndex` → có lỗ thứ tự (không sai chức năng, chỉ không liên tục).

---

## 5. REVIEWS — đánh giá + rating cho TRUYỆN (Story), không phải nhạc

### Mục đích
Mỗi user đánh giá 1 truyện 1 lần (upsert): điểm 1–5 + nội dung. Có like, "hữu ích" (helpful),
và reply 2 cấp. Đồng bộ `averageRating`/`ratingCount` về `Story`.

### File chính
- `be/src/reviews/reviews.controller.ts` — `@Controller('stories/:storyId')` (gắn dưới story).
- `be/src/reviews/reviews.service.ts`.
- DTO: `create-review.dto.ts`, `create-review-reply.dto.ts`, `list-reviews.dto.ts`
  (enum `ReviewSortType`: NEWEST/HIGHEST/HELPFUL), `list-review-replies.dto.ts`.
- Schema: `Review` (`:634`, unique `[userId, storyId]`), `ReviewLike` (`:660`),
  `ReviewHelpful` (`:674`), `ReviewReply` (`:688`, self-relation 2 cấp).

### Endpoint (`storyId` nhận id HOẶC slug — `resolveStoryId`)
| Method | Route | Quyền | Logic |
|---|---|---|---|
| GET | `/stories/:storyId/rating-stats` | public | trung bình + phân bố 5→1 sao |
| GET | `/stories/:storyId/reviews` | public (auth optional) | list; sort newest/highest/helpful; kèm `likedByMe/helpfulByMe` nếu có user; mỗi review kèm 2 reply gốc |
| POST | `/stories/:storyId/reviews` | auth | **upsert** theo `[userId, storyId]`; validate rating 1–5; sau đó `syncStoryRating` |
| POST | `/stories/:storyId/reviews/:reviewId/like` | auth | toggle like + đếm lại `likesCount` |
| POST | `/stories/:storyId/reviews/:reviewId/helpful` | auth | toggle helpful + đếm lại `helpfulCount` |
| GET | `/stories/:storyId/reviews/:reviewId/replies` | public | list reply gốc + children |
| POST | `/stories/:storyId/reviews/:reviewId/replies` | auth | tạo reply (parentId optional, 2 cấp) |

### `syncStoryRating`
Sau upsert review: aggregate avg + count toàn bộ review của story, ghi `Story.averageRating`
(`Decimal(2 chữ số)`) và `Story.ratingCount`.

### TÌNH TRẠNG: **done**.

### LỖI CẤU TRÚC / CẠM BẪY
- ⚠ **`storyId` trong route thực ra là id-hoặc-slug** — đặt tên gây hiểu nhầm; mọi method gọi
  `resolveStoryId` (thêm 1 query). Reply/like routes vẫn truyền `storyId` nhưng KHÔNG dùng nó
  (chỉ dùng `reviewId`) → param thừa.
- ⚠ **`toggleLike`/`toggleHelpful` không transaction**: xoá/tạo rồi `count()` rồi `update` —
  3 thao tác rời, race condition khi bấm nhanh.
- ⚠ **Không cập nhật review khi XOÁ**: không có endpoint xoá review; nếu xoá ở DB thì `syncStoryRating`
  không chạy → rating lệch (THIẾU luồng xoá).
- ⚠ `upsert` cho phép `content` rỗng (null) — review chỉ-điểm-số được, đúng nghiệp vụ nhưng cần biết.
- ⚠ Reply 2 cấp nhưng list reply chỉ load `children` 1 tầng (cấp 3 sẽ không hiện).

---

## 6. CHAPTER-COMMENTS — bình luận chương + reactions + reports (god-controller phía user)

### Mục đích
Bình luận trên CHƯƠNG truyện, có 2 phạm vi (scope): `chapter` (bình luận chung) và `paragraph`
(bình luận theo đoạn — lưu chỉ số đoạn vào `timestampSeconds`!). Có reaction (helpful/like/love),
report vi phạm, và bộ API quản trị report.

### File chính
- `be/src/chapter-comments/chapter-comments.controller.ts` — `@Controller()` (KHÔNG prefix →
  route tự do: `chapters/:chapterId/comments`, `comments/:commentId/...`, `comments/reports/...`).
- `be/src/chapter-comments/chapter-comments.service.ts`.
- DTO: `create-chapter-comment.dto.ts` (enum `ChapterCommentScope`: chapter/paragraph),
  `list-chapter-comments.dto.ts` (enum `ChapterCommentSortType`), `toggle-comment-reaction.dto.ts`,
  `create-comment-report.dto.ts`, `list-comment-reports.dto.ts`, `update-comment-report.dto.ts`.
- Schema: `ChapterComment` (`:980`, self-relation `CommentReplies`), enum `CommentReactionType`
  (`helpful|like|love`, `:1013`), `CommentReaction` (`:1019`, unique `[userId,commentId,type]`),
  enum `CommentReportStatus` (`pending|reviewed|resolved|dismissed`, `:1036`),
  `CommentReport` (`:1043`).

### Endpoint
| Method | Route | Quyền | Logic |
|---|---|---|---|
| GET | `/chapters/:chapterId/comments/counts` | public | đếm comment theo từng đoạn (group by `timestampSeconds`) |
| GET | `/chapters/:chapterId/comments` | public | list comment gốc theo scope; sort NEWEST/HELPFUL/ALL; kèm 3 reply + reactions |
| POST | `/chapters/:chapterId/comments` | auth | tạo comment/reply; nếu scope=paragraph thì set `timestampSeconds = paragraphIndex` |
| GET | `/comments/:commentId/replies` | public | list reply (1 cấp) + reactions |
| POST | `/comments/:commentId/reactions` | auth | toggle reaction theo `type`; sau đó set `likesCount = số reaction 'helpful'` |
| POST | `/comments/:commentId/report` | auth | report (không tự report mình; chặn report trùng khi đã pending/reviewed) |
| GET | `/comments/reports` | ADMIN | list report (search rộng nhiều bảng) |
| GET | `/comments/reports/stats` | ADMIN | thống kê theo status |
| PATCH | `/comments/reports/:reportId` | ADMIN | cập nhật status/adminNote + tuỳ chọn `hideComment` (ẩn comment, transaction) |

### Điểm "ngầm" quan trọng
- **`timestampSeconds` bị tái dụng làm chỉ số đoạn (paragraphIndex)** — tên cột dễ gây hiểu
  nhầm là mốc thời gian audio. `paragraphIndex` trong response chính là `timestampSeconds`.
- **`likesCount` của comment = số reaction loại `helpful`** (chỉ helpful, không tính like/love),
  cập nhật sau mỗi toggle. Sort HELPFUL dựa trên cột này.
- Sort `HELPFUL` giới hạn cứng 10 kết quả, `lastPage=1` (không phân trang).
- Comment ẩn (`isHidden`) bị loại khỏi mọi list công khai.

### TÌNH TRẠNG: **done** (đủ user + admin moderation).

### LỖI CẤU TRÚC / CẠM BẪY
- ⚠ **Reuse `timestampSeconds` cho paragraphIndex** — nợ kỹ thuật, dễ hiểu sai schema.
- ⚠ **`likesCount` chỉ phản ánh reaction `helpful`** → tên cột sai lệch ngữ nghĩa.
- ⚠ `toggleReaction` không transaction (find→delete/create→groupBy→update, race).
- ⚠ `create` kiểm tra `chapter.storyId` **2 lần** (dòng 239 và 255) — code chết/trùng.
- ⚠ Không giới hạn độ sâu reply ở DB; controller chỉ cho gắn vào comment cùng chapter, nhưng
  service không ép 1 cấp như music-comment → có thể tạo reply-của-reply (list chỉ hiện 1 tầng).

---

## 7. COMMENTS (admin) — module quản trị bình luận chương

### Mục đích
Bảng điều khiển admin để duyệt/ẩn/xoá `ChapterComment`. **Trùng chức năng một phần** với phần
admin của `chapter-comments` (reports) — đây là quản trị chính comment, kia là quản trị report.

### File chính
- `be/src/comments/comments.controller.ts` — `@Controller('comments')`, **toàn bộ ADMIN**
  (`JwtAccessGuard + RolesGuard + @Roles('ADMIN')` cấp class).
- `be/src/comments/comments.service.ts`.
- DTO: `comment-query.dto.ts`, `update-comment.dto.ts`.

### Endpoint (ADMIN)
| Method | Route | Logic |
|---|---|---|
| GET | `/comments` | list `ChapterComment` (filter `isHidden/storyId/chapterId/search`), kèm user/chapter/story/parent/_count |
| GET | `/comments/stats` | tổng/ẩn/hiện/hôm nay |
| PATCH | `/comments/:id` | cập nhật (vd ẩn) — `data: updateCommentDto` truyền thẳng |
| DELETE | `/comments/:id` | xoá comment |

### TÌNH TRẠNG: **done** nhưng **chồng lấn** với chapter-comments.

### LỖI CẤU TRÚC / CẠM BẪY
- ⚠ **XUNG ĐỘT ROUTE TIỀM TÀNG**: `comments.controller.ts` dùng `@Controller('comments')` với
  `PATCH/DELETE /comments/:id` (ADMIN), trong khi `chapter-comments.controller.ts` (no-prefix)
  có `POST /comments/:commentId/reactions`, `/comments/:commentId/report`,
  `GET/PATCH /comments/reports...`. Hai controller cùng đăng ký namespace `comments/*`.
  `GET /comments/reports` (chapter-comments) vs `GET /comments` (comments) — thứ tự khớp route của
  Nest quyết định; **rủi ro `comments/reports` bị nuốt bởi `:id` nếu định nghĩa sai thứ tự**.
  → Cần gộp/đặt tên rõ ràng khi refactor.
- ⚠ `PATCH /comments/:id` đổ thẳng `updateCommentDto` vào `data` (mass-assignment) — cần kiểm DTO.
- ⚠ `DELETE` xoá cứng (cascade reply/reaction/report theo schema), không soft-delete.
- ⚠ Trùng vai trò với `chapter-comments` admin → 2 nguồn sự thật cho việc ẩn comment
  (`comments PATCH isHidden` và `chapter-comments PATCH reports hideComment`).

---

## 8. GOD-SERVICE & ĐIỂM NÓNG CẦN REFACTOR (tóm tắt)

1. **`music.service.ts`** (~940 dòng) — god-service: trộn CRUD, pricing, slug, playlist
   enrichment, ẩn track con, lọc tag in-app. Nên tách: `MusicPricingService`,
   `MusicPlaylistResolver`, `MusicQueryService`.
2. **`music-interaction.service.ts`** — quét toàn bộ playlist để check unlock track lẻ
   (`findPlaylistUnlockForTrack`) và tính giá playlist (`calculateDiscountedPlaylistUnlockPrice`)
   → O(n) query, cần bảng quan hệ playlist↔track thực (đang dùng Json `playlistTrackIds`).
3. **Bộ đếm denormalized** (`likeCount/commentCount/playCount`, `likesCount`, `helpfulCount`)
   cập nhật thủ công ở nhiều chỗ, nhiều chỗ đọc-rồi-ghi không transaction → nguồn lệch số liệu.
4. **Hai hệ comment riêng** (music-comment vs chapter-comment) lặp logic like/reply/serialize.
5. **Hai controller admin comment chồng route** (`comments` + `chapter-comments`).
6. **Quan hệ playlist lưu bằng Json** (`Music.playlistTrackIds`) thay vì bảng nối → mất ràng buộc
   FK, phải tự xác minh và quét tay khắp nơi.

---

## 9. PHẦN CÒN THIẾU (TODO toàn vùng)
- Chia sẻ **playlist cá nhân công khai** (schema có `isPublic` nhưng không có route).
- **Xoá review** + đồng bộ rating khi xoá.
- **Soft-delete / audit** cho comment (hiện xoá cứng).
- Giới hạn độ dài / chống spam cho music-comment (chưa có MaxLength, play count không auth).
- Reaction cho music-comment chỉ có "like" (chapter-comment có helpful/like/love) — chưa đồng bộ.
- Báo cáo (report) cho music-comment (chỉ chapter-comment có report).
