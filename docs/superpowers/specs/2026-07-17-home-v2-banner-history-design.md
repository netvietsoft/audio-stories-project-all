# Home v2 — Banner carousel + Đọc tiếp (history local-first, sync ngầm) — Design (Spec A)

> Ngày: 2026-07-17 · App: NovelVerse Flutter · Trạng thái: design đã duyệt (user chốt layout card More nguyên văn), chờ review → plan.
> Đợt này gồm 2 spec chạy TUẦN TỰ: **Spec A (file này)** — banner + Continue Reading nâng cấp; **Spec B (viết sau khi A xong)** — Google Sign-In (cần thêm endpoint BE `POST /auth/google/mobile` + user tạo OAuth Client trên Google Console).

## 1. Banner carousel

> **⚠ Erratum 2026-07-17:** BE thật serve bảng `HeroBanner` — không có `position`, id là UUID string, key link là `targetUrl`, kèm `story{slug}`. Contract đúng: `BannersRepository.list({lang='vi'})` → `GET /banners?lang=`; `AppBanner {id: String, title, imageUrl, targetUrl: String?, storySlug: String?}`. Bấm banner: `storySlug` → mở in-app `/book/<slug>`; else `targetUrl` → browser ngoài. Chi tiết trong plan (khối ERRATUM đầu file).

- **Data**: repo mới `BannersRepository.list({position = 'home_hero'})` → `GET /banners?position=home_hero` (public; BE tự lọc isActive + start/endDate, sort orderIndex). Model app `AppBanner {id:int, title, imageUrl, linkUrl: String?}` (đặt trong file repo, pattern như các repo khác). Endpoint const `banners` ĐÃ có trong api_endpoints.dart.
- **UI** (`novel_home_screen.dart`): carousel đặt **dưới header "Reading", trên Editor's Pick**. `PageView` + auto-slide 5s (Timer, dừng khi user đang kéo — hoặc đơn giản: Timer đổi trang, animateToPage) + hàng chấm trang; ảnh `CachedNetworkImage` bo góc như thẻ hero, tỉ lệ khung ~5:2 (`AspectRatio(2.5)`). 1 banner → không auto-slide, không chấm.
- **Hành vi bấm**: `linkUrl` null/rỗng → không bấm được; chứa `/story/` → parse slug → `context.push('/book/<slug>')` trong app; còn lại → mở trình duyệt ngoài qua **`url_launcher`** (dep MỚI).
- **Fallback**: lỗi/rỗng/offline → ẨN cả section (không skeleton). Load cùng đợt `_loadHomeFeeds` (state riêng `_banners`, lỗi nuốt).

## 2. Lịch sử đọc local-first — `ReadingHistoryStore`

- **Lưu trữ**: Hive box mới `readingHistory` (Hive đã init sẵn trong app) — map `bookId(slug) → entry` (Map thuần, KHÔNG TypeAdapter):
  `{bookId, storyUuid: String?, title, cover, synopsis, genre, reads, totalChapters: int, chapter: int, savedAt: int(ms)}`
- **Ghi**: trong reader, chỗ `_recordLastRead(ch)` hiện có (đã có Book đầy đủ: title/cover/synopsis/genre/reads/chapters/uuid) → ghi/cập nhật entry + `savedAt = now`. Giới hạn **50 entry** mới nhất (vượt → xoá cũ nhất).
- **Đọc**: `entries()` trả list sort `savedAt` desc. Khách (deviceId) hay có tài khoản đều ghi local như nhau — "Đọc tiếp" tức thời, offline được.
- `AppState.lastRead*` hiện có GIỮ NGUYÊN (card Home 1 truyện vẫn chạy từ đó — không refactor); store mới chỉ BỔ SUNG danh sách. (Hợp nhất về 1 nguồn là việc dọn sau.)

## 3. Home — Continue Reading + "More..."

- Hàng tiêu đề section `Continue Reading` thêm **"More..."** bên phải, **cùng cột với "View All"** của For You — dùng chính `_sectionHeader(context, 'Continue Reading', onMore: ..., moreLabel: 'More...')` sẵn có (nút tự ẩn khi onMore null).
- "More..." chỉ hiện khi history local có ≥ 1 entry; bấm → `context.push('/reading-history')`.
- Card 1 truyện hiện tại giữ nguyên.

## 4. Màn `/reading-history` — danh sách đang đọc dở (layout user chốt NGUYÊN VĂN)

- File mới `lib/screens/novel/reading_history_screen.dart` + route (pattern như `/category/:id`). AppBar "Đang đọc".
- **Mỗi tác phẩm 1 hàng** (tương tự card đọc dở ở Home nhưng to hơn):
  - **Thumb truyện to nhất phía tay trái** (CoverImage ~96px bề ngang, bo góc);
  - **Tiêu đề truyện** (1 dòng, ellipsis);
  - **Tóm tắt nội dung: 20 TỪ** — cắt `synopsis` theo TỪ (split whitespace, lấy 20 từ đầu + '…' nếu dài hơn), tối đa 2 dòng;
  - **Progress bar** thể hiện đọc dở (`chapter/totalChapters` clamp 0..1, style LinearProgressIndicator terracotta như card Home);
  - Dưới thanh: text **"Chương x / y"** (vd `Chương 3 / 100`);
  - **Dòng cuối**: tên **thể loại** (tay trái, gần thumb) · **số views** (`reads`) ngoài cùng bên phải.
- Bấm card → `context.push('/reader/<bookId>?ch=<chapter>')` (reader tự resume vị trí cuộn như hiện tại).
- List từ local store — mở tức thì, không loading network. Rỗng (không thể vì More ẩn khi rỗng, nhưng vẫn) → text "Chưa có truyện đang đọc".
- Vuốt-xoá (Dismissible) 1 entry: KHÔNG làm v1 (YAGNI — chưa yêu cầu).

## 5. Sync ngầm 2 chiều với BE (chỉ khi ĐÃ đăng nhập)

Flow user chốt: mở app → restore phiên → có tài khoản → đồng bộ ngầm app ↔ BE; khách → local-only (BE `/history*` yêu cầu Bearer; guest-sync server là việc sửa BE, NGOÀI phạm vi).

- **Push (app → BE)**: trong reader, sau `_recordLastRead` + đã login (`AuthNotifier.user != null`) + có `storyUuid` + `chapterId` → fire-and-forget `POST /history/sync {storyId: storyUuid, chapterId, progressSeconds: 0}` (DTO BE: storyId/chapterId UUID bắt buộc, progressSeconds ≥ 0). Lỗi nuốt.
- **Pull (BE → app)**: khi mở Novel Home và đã login (1 lần mỗi phiên — cờ trong AppState/notifier): `GET /history?limit=50` → merge vào local store:
  - Entry BE có `lastListenedAt` MỚI HƠN `savedAt` local (hoặc local chưa có truyện đó) → cập nhật/thêm entry local từ metadata story BE trả kèm (slug/title/thumbnail/totalViews; `chapter` suy từ chapterId nếu BE trả kèm chapter number — nếu không suy được thì giữ chapter local/1; synopsis/genre thiếu → chuỗi rỗng, card render bỏ dòng đó).
  - Local mới hơn → giữ local (BE sẽ được cập nhật qua push lần đọc kế).
- Repo method đặt trong `StoriesRepository` hay repo mới? → repo mới `HistoryRepository` (list + sync) cho gọn trách nhiệm, provider như các repo khác.

## 6. Ngoài phạm vi Spec A

- Google Sign-In (Spec B). Guest-sync history lên server (cần sửa BE). Vuốt xoá entry. Hợp nhất `AppState.lastRead*` vào store mới. `progressSeconds` audio thật (đang gửi 0).

## 7. Test

- `ReadingHistoryStore`: ghi/cập nhật entry, sort savedAt desc, giới hạn 50 (xoá cũ nhất), roundtrip Hive map.
- Cắt 20 từ: hàm thuần `truncateWords(s, 20)` — chuỗi ngắn giữ nguyên, dài thêm '…', nhiều whitespace liên tiếp không tạo từ rỗng.
- `BannersRepository.list`: fake ApiClient — đúng path/query, parse shape (linkUrl null OK), tolerant envelope.
- `HistoryRepository`: sync gửi đúng body; list parse story metadata.
- Merge logic thuần (tách hàm `mergeHistory(local, remote)` test được): BE mới hơn thắng, local mới hơn giữ, truyện mới thêm vào.
- analyze 0/0 + full test; UI verify trên A50s.

## 8. Quyết định đã chốt (2026-07-17)

1. Layout card More: nguyên văn user (thumb trái to · tiêu đề · tóm tắt 20 từ · progress bar · "Chương x/y" · thể loại trái + views phải · 1 tác phẩm/hàng).
2. History: hybrid local-first + sync ngầm khi login; khách = local-only (deviceId sẵn có, KHÔNG thêm Firebase).
3. Banner: vị trí dưới header Reading/trên Editor's Pick; position `home_hero`; dep mới `url_launcher` cho link ngoài.
4. Google Sign-In gộp trong đợt nhưng tách Spec B riêng, làm ngay sau A.
