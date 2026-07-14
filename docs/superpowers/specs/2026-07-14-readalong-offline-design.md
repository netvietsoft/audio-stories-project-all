# Read-along Offline (persist cues + SWR) — Design

> Ngày: 2026-07-14 · App: NovelVerse Flutter (thuần app, KHÔNG đụng BE/admin) · Trạng thái: design đã duyệt, chờ review → plan.
> Follow-up của Spec 2 (read-along import timing, `2026-07-08-reader-readalong-import-design.md`) — mục "Read-along offline" trong danh sách deferred.

## 1. Mục tiêu

Chương đã tải (downloaded/auto-cache) khi đọc **offline** vẫn tô sáng câu theo audio đã tải
(read-along), thay vì `cues` luôn rỗng như hiện tại. Kèm quyết định chính sách làm mới:
**SWR nền** — mở chương đã tải thì đọc local tức thì, đồng thời (nếu online) refresh nền
content + cues từ API; timing mới có hiệu lực **lần mở chương sau**.

## 2. Hiện trạng (nguồn gốc vấn đề)

- `StoriesRepository.chapterContent` nhánh local-first (`off.hasChapter(id) && (isDownloaded || offline)`)
  trả `ChapterContent` **không có `cues`** → read-along tắt khi đọc bản đã tải.
- Nhánh online đã parse `cues` từ `timing.cues` nhưng auto-cache (`saveChapter`) **không lưu**.
- `DownloadManager` (textWorker + autoCache audio) khi ghi đè `OfflineChapter` sẽ **xoá mất cues**
  nếu model có field mà không merge.
- `OfflineChapter` (Hive Map thuần, không TypeAdapter) chưa có field `cues`.

## 3. Phạm vi

**Trong:**
- Thêm `cues` vào `OfflineChapter` + lưu ở mọi chỗ ghi + đọc ra ở nhánh local.
- SWR nền trong `chapterContent` khi mở chương đã tải lúc online.

**Ngoài (không làm):**
- Không đụng `reader_screen.dart` (reader đã nhận `ChapterContent.cues` sẵn — Spec 2).
- Không đụng BE/admin, HLS/entitlement, `AppState`, eviction/`bytesText` (auto-cache text hiện
  tại cũng không cập nhật bytes — giữ nguyên chính sách).
- Không cập nhật cues "live" giữa phiên đọc (chỉ áp dụng lần mở sau).
- Không migration Hive: record cũ thiếu key `cues` → `fromMap` default `[]`.

## 4. Thiết kế

### 4.1. Model — `OfflineChapter.cues`

`final List<Map> cues` (mặc định `const []`) — lưu **raw map wire-format BE** `{s,e,p,cs,ce}`,
không tạo class mới (đúng ràng buộc Hive Map thuần, không TypeAdapter/build_runner).
- `toMap()` thêm `'cues': cues`; `fromMap` đọc `(map['cues'] as List? ?? const []).cast<Map>()`.
- `copyWith` bảo toàn `cues` (như các field khác).

### 4.2. Ghi — nguyên tắc "cues đi cùng content" (3 chỗ)

| Chỗ ghi | Thay đổi |
|---|---|
| `StoriesRepository.chapterContent` — auto-cache sau fetch online | Lưu thêm cues raw: `(timing['cues'] as List).whereType<Map>().toList()`; response không có timing → lưu `[]` (server là nguồn sự thật — admin gỡ timing thì local cũng gỡ). |
| `DownloadManager` textWorker (tải cả truyện) | Ghi đè bản ghi text: thêm `cues: existing?.cues ?? const []`. (Thứ tự sẵn có đảm bảo đúng: `chapterText` → `chapterContent` online → auto-cache đã lưu cues → `readChapter` ngay sau đó thấy cues.) |
| `DownloadManager.autoCache` (audio) | Tạo lại `OfflineChapter`: thêm `cues: existing?.cues ?? const []` (cùng cách đang giữ `existing?.content`). |

### 4.3. Đọc + SWR — `StoriesRepository.chapterContent` nhánh local

- Trả `ChapterContent` kèm `cues: c.cues.map(TimingCue.fromMap).toList()` — reader offline
  highlight ngay, không sửa UI.
- **SWR:** tách phần fetch online + auto-cache hiện có thành method riêng (vd `_fetchAndCache(id)`).
  Nhánh local, khi **online** (`_connectivity?.isOnline != false`): sau khi có kết quả local,
  gọi `_fetchAndCache(id)` **fire-and-forget** (không await, nuốt lỗi) → Hive được cập nhật
  content + cues **từ cùng 1 response** (không bao giờ lệch offset). Khi **offline**: không gọi mạng.
- Nhánh online (không phải local-first) giữ nguyên hành vi: gọi `_fetchAndCache(id)` và await.

### 4.4. Edge cases

| Tình huống | Hành vi |
|---|---|
| Chương local chưa từng có timing | `cues` rỗng → toggle bật cũng không highlight (giống online). |
| Refresh nền lỗi mạng/API | Nuốt im lặng, giữ bản local. |
| Refresh nền chạy song song phiên đọc | Last-write-wins trên Hive; an toàn vì reader đã nạp cues vào state lúc `_loadContent`. |
| Admin re-import timing / sửa content | Lần mở khi online: đọc bản cũ + refresh nền; lần mở sau thấy bản mới, content+cues đồng bộ. |
| Record Hive cũ (trước field cues) | `fromMap` default `[]` — không migration. |

## 5. Test (theo pattern test sẵn có)

- `offline_models`: roundtrip `cues` qua `toMap`/`fromMap`; map thiếu key `cues` → `[]`;
  `copyWith` giữ cues.
- `stories_repository`: nhánh local trả đúng `TimingCue` từ cues đã lưu; local + online →
  có fire refresh nền và Hive được cập nhật cues mới; local + offline → không gọi mạng;
  auto-cache online lưu cues (và ghi `[]` khi response không có timing).
- `download_manager`: textWorker ghi đè không mất cues; autoCache audio giữ cues.

Chạy: `"/d/SetupC/flutter/bin/flutter.bat" test` (flutter KHÔNG trong PATH).

## 6. Quyết định đã chốt

- **Refresh khi online** (thay vì stale-như-text): người dùng chọn 2026-07-14.
- **SWR nền** (thay vì network-first hoặc chỉ fetch timing): giữ instant-open; timing mới có
  từ lần mở sau; refresh luôn lấy **cả chương** để content+cues không lệch offset.
- Lưu cues dạng **raw map** `{s,e,p,cs,ce}` trong Hive — tái dùng `TimingCue.fromMap`, không
  thêm serializer.
