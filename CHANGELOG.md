# CHANGELOG — NovelVerse (Flutter)

Nhật ký thay đổi app mobile. Ngày mới nhất ở trên. Chi tiết kiến trúc: [`docs/`](docs/README.md).

---

## 2026-07-08

### Đọc theo audio (read-along)
- **Admin** — chỗ upload audio ở form chương nhận thêm file **timing `.srt/.vtt/.lrc`**; đọc nội dung file (`file.text()`), tự đoán format theo đuôi (`.vtt`→vtt, `.lrc`→lrc, `.srt`→srt, đuôi khác→`auto`), gửi kèm `timingRaw`/`timingFormat` khi tạo/sửa chương.
- **BE** — parse file timing (`be/src/chapters/timing/timing-parser.ts`) → khớp câu vào đúng vị trí ký tự trong `content` (`timing-matcher.ts`, có bỏ qua dấu câu khi so khớp) → lưu `Chapter.timingJson` (cột mới, chương cũ không bị ảnh hưởng); trả về trong `timing` của `GET /chapters/:id/public`. Chạy đồng bộ lúc lưu chương (không qua worker như HLS).
- **App Reader** — nút tai nghe 🎧 trên top bar chỉ hiện khi truyện có ít nhất 1 chương có audio; toggle **"Đọc theo audio"** trong bảng cài đặt Aa (dưới Brightness), lưu máy; khi bật + chương có timing + đúng audio chương đang phát → câu đang đọc được tô sáng (nền terracotta) và tự cuộn theo.
- Chỉ tô theo **câu/dòng** (theo cue của file timing), chưa tới mức từng chữ; chưa có bản offline (đọc theo audio hiện chỉ chạy khi online).

---

## 2026-07-01

### Tích hợp backend (data layer)
- **`lib/api/`** — gom kết nối 1 chỗ: `api_env.dart` (env dev/staging/prod, cờ `USE_BACKEND`, base URL — đổi domain/IP khi lên VPS), `api_endpoints.dart` (mọi path), `api_client.dart` (Dio: bóc envelope `{data,meta}`, Bearer, auto-refresh 401, `resolveRedirect` cho audio 302, `postRaw` đọc Set-Cookie), `api_exception.dart`, `token_store.dart` (secure storage).
- **`lib/data/`** — repositories: stories (explore/detail/chapterContent), music, audio, auth, categories + mappers (book/chapter/song/user/category) + `cache/json_cache.dart`.
- **`lib/state/`** — `AsyncValue` + notifiers stories/music/auth (fallback Demo khi tắt BE/lỗi).
- Mặc định `USE_BACKEND=false` → chạy dữ liệu `Demo` như cũ; bật bằng `--dart-define`.

### Màn đã nối API (skeleton/error/data + SWR cache)
- Discover, Novel Home, Audio Home, Audio Library, Book Detail, Reader, Login, Profile.

### Auth
- Login (`/auth/login`) + `/auth/me`; access token + **refresh đọc từ Set-Cookie → secure storage → gửi header `x-refresh-token`** khi `/auth/refresh`; ApiClient auto-refresh 401; `restore()` lúc mở app. Profile hiện user thật + đăng nhập/đăng xuất.

### Audio (just_audio)
- Đổi `audioplayers` → **`just_audio`** (ExoPlayer/media3).
- **Ưu tiên HLS m3u8 (Cloudflare)** khi có `hlsUrl` (kèm Bearer cho key/segment); fallback MP3 `LockCachingAudioSource` (cache đĩa) / proxy 302.
- **Preload ~30s** (`AudioLoadConfiguration`) + playlist preload bài kế; nút **next/prev** (album/player) chạy (wrap vòng); thanh **buffer** + thời gian **thích ứng** (`formatClock`).
- ⚠ **Audio KHÔNG lọc theo ngôn ngữ** (BE `Music` chưa có `languageId`) — xem [docs/07](docs/07-noi-backend.md).

### Cache (chống giật, mở nhanh, offline)
- Ảnh thumbnail: **`cached_network_image`** (cache đĩa).
- Data: **`json_cache`** (prefs + TTL 10' stale-while-revalidate) cho stories + music.
- Audio MP3 đã phát: cache đĩa qua `LockCachingAudioSource`.

### Ngôn ngữ
- **Ngôn ngữ nội dung** (`AppState.contentLang`, mặc định `en`, lưu máy) — lọc **stories + categories** qua param `lang`/`language`; đổi là reload; chọn trong Settings. (Audio chưa lọc — BE chưa hỗ trợ.)
- **Ngôn ngữ hiển thị (i18n)** — dựng **`lib/l10n/`** (gen-l10n + ARB `app_en.arb`/`app_vi.arb`), `context.l10n.*`; áp cho bottom nav, toggle Novel/Audio, Language Settings. Xem [`lib/l10n/README.md`](lib/l10n/README.md).
- **Category thật từ BE** (`/stories/categories`, cùng nguồn web) — Discover hiện chip thể loại thật + lọc theo `categoryId`.

### Thiết kế (theo ảnh trong `anh/`)
- **Home** (`home.png`): header "Reading" + hero "Editor's Pick" + Continue Reading (chapter + %) + For You "View All" + Hot Ranking "Today ▾"; top bar 🎁 + 🌐 (ngôn ngữ).
- **Reader** (`readding/set trang/nghe truyện/cuoi trang`): appbar 🎧/🔖/Aa/☰; tên chương căn giữa; **bong bóng bình luận** theo đoạn; **Reading settings chi tiết** (5 nền, màu chữ, cỡ A±, font Serif/Sans/Dyslexia, line, margin); **menu dưới 4 tab auto-hide theo cuộn**; **thanh read-along** khi nghe; **End of Chapter** (thẻ Comment/Support/Share + Previous/Next chapter). Icon settings thu ~70%.

### Nền tảng / thiết bị
- **Khóa dọc** (portrait) — `SystemChrome` + manifest `screenOrientation`.
- Build: Flutter tại `D:\SetupC\flutter`. Fix build APK: trust store Avast (SSL scanning) trong `gradle.properties`; `flutter_secure_storage` pin AGP → align cached; `usesCleartextTraffic=true` (gọi BE HTTP LAN). Cài máy test qua adb (bật "Install via USB").

### Dọn code (theo CLAUDE.md)
- Bỏ dead code: `StoriesRepository.bySlug`, `ApiClient.patch/delete`, biến thừa; 0 lỗi/0 warning `flutter analyze`.

---

## 2026-06-30

### Khởi tạo tài liệu + docs
- Viết bộ **`docs/`** (01 kiến trúc … 07 nối backend) + README cho từng thư mục `lib/`.
- Thêm persist `AppState` (`shared_preferences`): theme/mode/coin/liked/unlocked.

---

> BE (NestJS) changelog: xem `../backend/first_readme.txt §8` (nhật ký) + `../backend/docs/`.
> Hợp đồng API mobile: `../backend/docs/10-mobile-api.md`.
