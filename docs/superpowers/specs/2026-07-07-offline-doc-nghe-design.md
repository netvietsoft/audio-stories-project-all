# Offline đọc & nghe (NovelVerse Flutter) — Design Spec

> Ngày: 2026-07-07 · Trạng thái: đã duyệt design, chờ review spec → lập plan.

## 1. Mục tiêu

Khi app đã tải dữ liệu về, **lưu ở máy để mất mạng vẫn đọc truyện + nghe audiobook được**. Hai cơ chế:
- **Auto-cache:** chương người dùng đã mở/nghe tự lưu lại (giới hạn dung lượng, đầy → xoá LRU).
- **Download thủ công:** bấm "Tải xuống" ở BookDetail để lưu **cả truyện** (mọi chương: text + audio), giữ **vĩnh viễn** đến khi user xoá.

Kèm 2 cải tiến BookDetail cùng màn:
- Ẩn nút **Listen Now** khi truyện không có audio.
- Danh sách chương: **lazy render** + nút **thu gọn reveal-on-scroll-up** (giải quyết 1K chương).

## 2. Phạm vi

**Trong phạm vi:**
- Chỉ **chế độ Novel**: text chương + audiobook chương (file MP3/CDN qua proxy `/chapters/:id/audio`).
- Auto-cache + Download cả truyện + màn quản lý "Đã tải" + xoá.
- Nhận biết online/offline, đọc local-first.
- 2 cải tiến BookDetail (Listen có điều kiện, chapter list).

**Ngoài phạm vi (v1):**
- Music/album (nhạc HLS AES-128) — không tải offline.
- Cache offline HLS.
- Badge "có audio" ở màn list/grid (chỉ làm ở BookDetail).
- Đồng bộ trạng thái tải giữa nhiều thiết bị.

## 3. Kiến trúc

Thêm **lớp offline** giữa repository và nguồn dữ liệu; không đập bỏ `JsonCache`/`TokenStore`/luồng online hiện có.

```
UI (Reader / BookDetail / Downloads screen)
        │
   Repositories (StoriesRepository, AudioRepository)   ← thêm nhánh "local-first"
        │
 ┌──────┴───────────────────────────┐
 │            OfflineStore           │
 │  ┌────────────┐  ┌─────────────┐  │
 │  │ Hive boxes │  │  FileStore  │  │
 │  │ metadata + │  │ audio files │  │
 │  │ text chương│  │(path_provider)│
 │  └────────────┘  └─────────────┘  │
 └───────────────────────────────────┘
        │ (khi online / cache miss)
   ApiClient (Dio) ──► Backend
```

**Thành phần mới (mỗi cái một nhiệm vụ rõ):**
- **`OfflineStore`** — API nội bộ: `hasStory/hasChapter`, `readChapter`, `readAudioPath`, `readStoryMeta`, `saveChapter`, `saveAudio`, `saveStoryMeta`, `upsertDownload`, `deleteStory`, `listDownloads`, `touch(lastAccess)`, `totalBytes(kind)`.
- **`DownloadManager`** — điều phối tải cả truyện: lấy chi tiết + danh sách chương → tải text + audio từng chương tuần tự → cập nhật tiến độ/trạng thái; chống tải trùng; huỷ; retry phần lỗi.
- **`FileStore`** — bọc `path_provider`: quản lý thư mục audio, ghi/đọc/xoá file, tính size.
- **`ConnectivityService`** — online/offline (`connectivity_plus`), phát trạng thái cho repository + UI.
- **`OfflineNotifier`** (`ChangeNotifier`) — state cho UI: danh sách đã tải, tiến độ tải, tổng dung lượng.

**Nguyên tắc đọc:** repository thử **local trước nếu (đã tải) hoặc (offline)**; ngược lại gọi mạng rồi (nếu bật auto-cache) ghi local.

## 4. Data model

### 4.1 Hive boxes

**`downloads`** (key = `storyId`) — sổ đăng ký mỗi truyện:
```
storyId, slug, title, cover, author, language
kind: 'downloaded' | 'auto'
totalChapters, savedChapters
status: 'pending'|'downloading'|'complete'|'failed'|'paused'
bytesText, bytesAudio
createdAt, lastAccessAt          // lastAccess → LRU cho 'auto'
```

**`chapters`** (key = `chapterId`) — nội dung text mỗi chương:
```
chapterId, storyId, n, title
content (text)
audioFile: String?               // tên file trong FileStore; null nếu chưa/không có audio
hasAudio: bool
```

**`storyMeta`** (key = `storyId`) — dựng lại BookDetail/Reader offline:
```
synopsis, rating, reads, status, genre, trope, unlockPrice, cover, author, subtitle
chapters: [{chapterId, n, title, state(locked/free/vip/coin), hasAudio}]
```

### 4.2 Bố cục file (FileStore)
```
<AppDocuments>/offline/audio/<storyId>/<chapterId>.mp3
```
- Thư mục theo `storyId` → xoá truyện = xoá nguyên thư mục.
- Đặt ở **AppDocuments** (không phải cache dir) để OS không tự xoá phần download.
- **Cover ảnh:** dùng lại `cached_network_image` (tự cache đĩa) — không tự quản riêng; miss thì hiện placeholder gradient sẵn có.

**Key nhất quán:** dùng `storyId`/`chapterId` (UUID từ BE) xuyên suốt Hive + file + API.

## 5. Luồng tải & phục vụ

### 5.1 Download thủ công (cả truyện)
1. `DownloadManager.downloadStory(storyId)` → tạo record `downloads` (`kind:'downloaded'`, `status:'downloading'`).
2. `_repo.detail(storyId)` → lưu `storyMeta`.
3. Lặp từng chương tuần tự: `chapterContent` → lưu `chapters.content`; nếu `hasAudio` → `chapterAudioUrl` → `dio.download` vào FileStore → set `audioFile`, cộng bytes, tăng `savedChapters` → `OfflineNotifier` báo %.
4. Xong → `status:'complete'`. Chương lỗi → đánh dấu, tiếp tục; cuối cho **Retry** phần lỗi. Cho **huỷ** (xoá phần dở).

### 5.2 Auto-cache (khi đọc/nghe)
- Sau fetch online thành công trong Reader/AppState: ghi `chapters.content`; khi phát audio → lưu file audio; upsert record `downloads` với `kind:'auto'`, cập nhật `lastAccessAt`.
- Chỉ cache **chương đã thực sự mở/nghe**, không kéo cả truyện.

### 5.3 Phục vụ đọc/nghe
- `StoriesRepository.chapterContent(id)`: nếu `hasChapter(id)` **và** (downloaded **hoặc** offline) → trả text local + `touch`; ngược lại API rồi auto-cache.
- Audio: có file local → `AudioSource.uri(Uri.file(path))`; không + online → giữ luồng `LockCachingAudioSource`/HLS hiện tại.
- BookDetail/Reader dựng khung từ `storyMeta` khi offline.

### 5.4 Eviction (chỉ `kind:'auto'`)
- Ngưỡng mặc định **auto-cache ~200MB** (chỉnh trong settings sau).
- Sau mỗi auto-cache, nếu tổng bytes `auto` > ngưỡng → xoá dần record `auto` `lastAccessAt` cũ nhất (text + thư mục audio) tới khi dưới ngưỡng.
- `kind:'downloaded'` **không bao giờ** bị eviction.
- Truyện `auto` mà user bấm Download → nâng `kind` lên `'downloaded'` (bảo vệ khỏi eviction).

### 5.5 Offline detection
- `ConnectivityService` phát trạng thái; repository ưu tiên local; `AppShell` hiện banner mỏng "Đang offline — chỉ nội dung đã lưu".

## 6. BookDetail — 2 cải tiến

### 6.1 Nút Listen có điều kiện
- Model: `Chapter.hasAudio = (audioDuration ?? 0) > 0 || hlsUrl.isNotEmpty` (map trong `ChapterMapper`). `hasAudio` toàn truyện = `chapters.any((c) => c.hasAudio)`.
- Có audio → giữ **Read Now + Listen Now** (chia đôi). Không audio → **ẩn Listen Now**, **Read Now full-width**.
- Ăn khớp offline: chỉ tải audio cho chương `hasAudio`.

### 6.2 Danh sách chương: lazy + reveal-on-scroll-up
Hiện `_body` là `ListView` children tĩnh; `_allChapters=true` dựng cả 1K row một lượt → giật.

**Chuyển `_body` sang `CustomScrollView` (slivers):**
- `SliverToBoxAdapter`: phần trên (cover/stats/chips/synopsis/CTA/bundle) — nội dung giữ nguyên.
- `SliverPersistentHeader(pinned:true)`: tiêu đề "Chapters".
- `SliverList.builder`: chương **lazy**; `itemCount = _allChapters ? chapters.length : 5`.
- Footer `SliverToBoxAdapter`: nút "Xem tất cả N chương ▼" (khi thu gọn).

**Reveal-on-scroll-up:** thêm `ScrollController` nghe hướng cuộn. Khi `_allChapters=true`:
- Người dùng **cuộn LÊN** → hiện **1 nút nổi (floating pill) "Thu gọn ▲"** cố định gần đáy màn hình; **cuộn XUỐNG** → ẩn. (Pinned header chỉ chứa tiêu đề "Chapters", không chứa nút này.)
- Bấm "Thu gọn" → `setState(_allChapters=false)` + `scrollController.animateTo` về vị trí tiêu đề "Chapters".

**Phạm vi:** độc lập offline nhưng cùng màn → cùng spec, mục riêng.

## 7. UI surfaces
- **BookDetail:** nút "Tải xuống" cạnh Read/Listen (vòng tiến độ %, xong ✓ + xoá); icon trạng thái nhỏ cạnh từng chương (đã lưu/đang tải). Nút Listen có điều kiện (6.1). Chapter list (6.2).
- **Màn "Đã tải"** (`/downloads`, vào từ Profile): list truyện đã tải (bìa/tên/số chương/dung lượng), tổng dung lượng tách *Đã tải*/*Tự lưu*, nút Xoá từng truyện + "Xoá cache tự động". Dùng lại `CoverImage`.
- **Reader/Player:** offline chỉ mở chương đã lưu; chưa lưu + offline → "Chưa tải chương này".
- **Banner offline** toàn cục trong `AppShell`.
- UI bám theme hiện có (terracotta, `context.pal`, sheets).

## 8. Điểm tích hợp (surgical)
- `main.dart`: `Hive.initFlutter()` + mở box + khởi tạo `OfflineStore/FileStore/DownloadManager/ConnectivityService`, cung cấp qua provider (giống `JsonCache`).
- `StoriesRepository`: nhánh local-first ở `chapterContent` + `detail`.
- `AudioRepository`/`AppState`: chọn `Uri.file` khi có audio local.
- `models.dart` + `ChapterMapper`: thêm `hasAudio`.
- `router.dart`: thêm `/downloads`. `profile_screen`/`book_detail_screen`: entry + nút + rewrite chapter list.
- **Không** đụng `JsonCache`, `TokenStore`, luồng online.

## 9. Gói mới
`hive`, `hive_flutter`, `path_provider`, `connectivity_plus`. (Dio đã có → `dio.download`.)

## 10. Xử lý lỗi
- Mất mạng giữa chừng tải → chương lỗi `failed`, giữ phần đã tải, cho Retry.
- Hết dung lượng đĩa → dừng tải, báo rõ, không hỏng record.
- File audio mất/hỏng → coi như chưa có → fallback online nếu được, hoặc báo.
- Ghi Hive/file lỗi → nuốt ở tầng cache (không sập đọc online), log.

## 11. Testing (goal-driven)
- Unit `OfflineStore`: save/read/delete round-trip; eviction LRU (auto vượt ngưỡng → xoá cũ nhất; downloaded không bị xoá); nâng `kind` auto→downloaded.
- `DownloadManager`: tải đủ chương; 1 chương lỗi → tiếp tục + retry; huỷ giữa chừng dọn sạch; skip audio khi `!hasAudio`.
- Repository local-first: mock offline → trả local không gọi API; online cache miss → gọi API + ghi cache.
- Mapper: `hasAudio` đúng theo audioDuration/hlsUrl.
- Widget: BookDetail đổi nút theo tiến độ; ẩn Listen khi không audio; chapter list lazy + reveal-on-scroll-up hiện/ẩn nút Thu gọn; màn Downloads xoá cập nhật list.

## 12. Ghi chú
- novelverse hiện **chưa nằm trong git repo** → spec này chưa được commit. Cân nhắc `git init` cho app.
- Ngưỡng auto-cache 200MB và cơ chế reveal-on-scroll-up có thể tinh chỉnh sau khi dùng thử.
