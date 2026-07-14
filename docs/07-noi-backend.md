# 07 — Lộ trình nối backend (NovelVerse Flutter)

> Thay dữ liệu `Demo` tĩnh bằng API thật của backend NestJS (`../backend/be`).
> §1–§3 là **đề xuất/roadmap**; §4b liệt kê phần **ĐÃ code**. Đối chiếu tài liệu BE trong
> `../backend/docs/`. Cập nhật: 2026-07-08.

═══════════════════════════════════════════════════════════════════════
## 1. NGUYÊN TẮC GỌI BACKEND (đọc trước)
═══════════════════════════════════════════════════════════════════════

Từ `../backend/docs/01-kien-truc.md` + `first_readme.txt`:

1. **KHÔNG có prefix `/api`.** Route trong code BE là route thật: `/stories`, `/music`,
   `/auth/login`, `/chapters/:id/audio`… Base URL = `http://<host>:3000`.
2. **Mọi response bọc `{ data, meta }`**; lỗi `{ error:{code,message,details?}, meta }`.
   Client PHẢI **unwrap `data`**. Một số endpoint list bọc 2 lớp (`{data:{data:[],meta}}`)
   — viết helper unwrap phòng thủ (giống FE web `unwrapList/unwrapData`).
3. **Tiền ảo phía BE = "Pulse"** (không phải "coin"). App đang gọi "coins" → khi nối,
   map `coins ↔ Pulse` (`User.pulseBalance`). Lưu ý cột DB còn tên cũ `credits`.
4. **Audio không lộ URL trong JSON public** — luôn qua proxy `GET /chapters/:id/audio`
   (302 sau entitlement) hoặc HLS `hlsUrl` (m3u8 + AES-128). Xem `../backend/docs/09-audio-pipeline.md`.
5. **Enum = nguồn sự thật** ở `../backend/be/prisma/schema.prisma` (status/access/unlock…).

═══════════════════════════════════════════════════════════════════════
## 2. MAPPING MODEL (Demo → API)
═══════════════════════════════════════════════════════════════════════

| Model app (`models.dart`) | Nguồn BE | Ghi chú mapping |
|---|---|---|
| `Book` | `GET /stories`, `/stories/explore`, `/stories/:slug` | `id`↔id/slug, `cover`↔thumbnail URL (R2), `reads/rating`↔counters. |
| `Book.label` (`StoryLabel{text,color,icon}`) | field `label` (object đã resolve sẵn `{id,name,text,color,textColor,icon}` hoặc null) trong response story → map thẳng vào `StoryLabel`; app KHÔNG có `labelId` (BE strip labelId/assignedAt/expiresAt, chỉ trả label đang hiệu lực), thay badge/tag cũ | render bìa (cover badge) `label.text` trên `label.color`. |
| `Chapter` + `ChapterState` | `/stories/:slug` (list chương), `/chapters/:id/public` | `ChapterState{free,coin,vip,current}` map theo `ChapterAccessType{free,timed,vip,ads}` + trạng thái unlock của user (3 cơ chế). |
| `TimingCue` (read-along) | `/chapters/:id/public` field `timing` | `{v,cues:[{s,e,p,cs,ce}],matched,total}` (null nếu chương chưa import timing) → map `s/e/p/cs/ce` vào `TimingCue`. Xem [08-read-along.md](08-read-along.md). |
| `Song` / `Chart` | `GET /music`, playlist/charts | `url`↔proxy/HLS, KHÔNG dùng path asset. `hlsUrl` rỗng cho tới khi worker transcode xong. |
| `CoinPack` | packages (JSON trong site_settings) / `/packages` | giá demo USD → **VND** (`priceVnd`) + `pulseAmount`. |
| `Plan` | membership/`/packages` | gói VIP + tier/expiry. |
| `Gift` | (chưa có bảng giao dịch gift ở BE) | giữ local hoặc chờ BE bổ sung. |

═══════════════════════════════════════════════════════════════════════
## 3. KIẾN TRÚC ĐỀ XUẤT KHI ONLINE
═══════════════════════════════════════════════════════════════════════

```
screens ──watch──► AppState (global: auth, player, theme)
   │
   └──► FeatureNotifier (loading/error/data mỗi vùng)   ← MỚI
            │
            └──► Repository (cache + map)                ← MỚI: thay Demo
                     │
                     ├──► ApiClient (dio + interceptor)  ← MỚI: base URL, unwrap, token, refresh
                     └──► LocalCache (hive + TTL)         ← MỚI: stale-while-revalidate
```

Thành phần cần thêm (giữ `AppState` gọn, không nhồi hết vào đó):
1. **`ApiClient`** (`dio`): base URL từ config; interceptor **unwrap `data`**; gắn
   `Authorization: Bearer <access>`; bắt 401 → refresh rồi retry.
2. **Auth**: access token (ngắn hạn) giữ RAM/`flutter_secure_storage`; refresh token →
   `flutter_secure_storage` (BE nhận qua header `x-refresh-token` hoặc cookie — strategy
   refresh đọc cả hai; mobile dùng header). Luồng: login/verify → lưu token → `/auth/me`.
3. **Repository theo vùng** (stories, music, billing, user) trả model app, ẩn chi tiết
   API + cache. Screens chỉ biết repository.
4. **`FeatureNotifier`** mỗi màn list/detail: state `loading/error/data` (xem [04 §4](04-routing-va-loading.md)).
5. **Cache** (hive + TTL, stale-while-revalidate): mở app hiện cache rồi refresh nền.
   Xem [06 §3.3](06-cache-va-tai-nguyen.md).

═══════════════════════════════════════════════════════════════════════
## 4. ĐIỂM CẦN ĐỒNG BỘ VỚI BE (nguồn sự thật online)
═══════════════════════════════════════════════════════════════════════

Các state hiện local-only phải lấy/đẩy về BE:

| App (local) | BE (nguồn sự thật) | Hành động |
|---|---|---|
| `coins`, `spendCoins/addCoins` | Pulse (`pulseBalance`) + `CreditTransaction` sổ cái | đọc số dư từ `/auth/me`; chi/nạp qua API (mua coin, unlock). |
| `vip` | membership / `vipTier`+`vipExpirationDate` | đọc từ user; mua qua luồng membership. |
| `unlockChapter` (Set local) | `UserChapterUnlock`/`UserStoryUnlock`/`UserUnlockedVariant` | gọi API unlock; đồng bộ entitlement. |
| `toggleLike` (Set title) | favorites/reviews | gọi API favorite; khoá theo **id** không phải title. |
| vị trí nghe | listening history/tracking | đẩy tiến độ; khôi phục khi mở lại. |

⚠ **Idempotency tiền tệ**: giao dịch Pulse/thanh toán xử lý ở BE (chống double-credit
— xem nhật ký backend H1/H10). App KHÔNG tự cộng/trừ tiền rồi mới gọi API; phải để BE
là trọng tài, app cập nhật theo phản hồi.

═══════════════════════════════════════════════════════════════════════
## 4b. ĐÃ TRIỂN KHAI (nền tảng + slice stories)
═══════════════════════════════════════════════════════════════════════

Bước 1 (nền tảng) + một phần bước 3 (stories) đã code. Bật bằng
`--dart-define=USE_BACKEND=true` (mặc định **tắt** → app dùng `Demo` như cũ).

| Thành phần | File |
|---|---|
| **Kết nối** (env domain/IP, `useBackend`, base URL theo dev/staging/prod) | `lib/api/api_env.dart` |
| Endpoint paths tập trung 1 nơi | `lib/api/api_endpoints.dart` |
| `ApiClient` (Dio, bóc `{data,meta}`, Bearer, map lỗi) + `unwrapList` | `lib/api/api_client.dart` |
| `ApiException` (code/message/status) | `lib/api/api_exception.dart` |
| `BookMapper.fromJson` (story→Book, id=slug) + `formatCount` | `lib/data/mappers/book_mapper.dart` |
| `StoriesRepository.explore/bySlug` + `PagedBooks` | `lib/data/repositories/stories_repository.dart` |
| `MusicRepository.list` + `SongMapper` | `lib/data/repositories/music_repository.dart`, `lib/data/mappers/song_mapper.dart` |
| `CategoriesRepository.getCategories` (`/stories/categories?language=`) + `CategoryMapper` + model `Category` | `lib/data/repositories/categories_repository.dart`, `lib/data/mappers/category_mapper.dart` |
| `AsyncValue` (loading/data/error) | `lib/state/async_value.dart` |
| `StoriesNotifier` (SWR, TTL **1 phút**, **KHÔNG** fallback demo → tắt BE trả rỗng) | `lib/state/stories_notifier.dart` |
| `MusicNotifier` (SWR, TTL **10 phút**, **CÓ** fallback `Demo.songs` + cờ `usingFallback`) | `lib/state/music_notifier.dart` |
| Provider wiring (MultiProvider) | `lib/main.dart` |
| `CoverImage` hỗ trợ URL mạng; `AppState.play` phát URL (`UrlSource`) | `lib/widgets/cover_image.dart`, `lib/state/app_state.dart` |
| `StoriesRepository.detail/chapterContent` + `StoryDetail`/`ChapterContent` + `ChapterMapper` | `lib/data/repositories/stories_repository.dart`, `lib/data/mappers/chapter_mapper.dart` |
| **Auth**: `TokenStore` (secure storage), `AuthRepository` (login/verify/refresh/logout/me), `AuthNotifier`, `AppUser`+`UserMapper`; ApiClient auto-refresh 401 | `lib/api/token_store.dart`, `lib/data/repositories/auth_repository.dart`, `lib/state/auth_notifier.dart` |
| **Audio chương thật**: `AudioRepository` + `ApiClient.resolveRedirect` (302→Location, kèm Bearer); `AppState.play` phát URL resolve | `lib/data/repositories/audio_repository.dart`, `lib/api/api_client.dart` |
| **Màn đã wire**: Discover, Novel Home, **For You** (`/for-you`), Audio Home, Audio Library; **BookDetail** (Listen→audio chương đầu) + **Reader** (nút nghe chương) ; **LoginScreen** + Profile | `lib/screens/**` |
| **i18n (UI)**: gen-l10n từ `l10n/*.arb`, `context.l10n.*`, `AppState.uiLang → Locale` (xem §4c) | `lib/l10n/**`, `main.dart` |
| **Read-along** (highlight câu đang đọc theo audio): `TimingCue` + `ChapterContent.cues` + `activeCueIndex`; Reader highlight `[cs,ce)` + auto-scroll + toggle (lưu `reader.readalong`); gate hiện icon "Nghe" ở cấp **truyện** (`chapters.any(hasAudio)`) | `lib/data/repositories/stories_repository.dart`, `lib/data/reader/reader_store.dart`, `lib/screens/novel/reader_screen.dart` — chi tiết [08-read-along.md](08-read-along.md) |
| **Track mở truyện từ Search** (Discover): mở kết quả search → `POST /tracking/search-open {storyId: Book.id (slug), deviceId}` (fire-and-forget, chỉ khi đang search, không chặn navigation); `deviceId` sinh 1 lần + lưu `shared_preferences` key `wta_device_id` | `lib/data/device_id.dart` (`getOrCreateDeviceId`), `lib/data/repositories/stories_repository.dart` (`trackSearchOpen`), `lib/api/api_endpoints.dart`, `lib/screens/novel/discover_screen.dart` (`_trackSearchOpen`) |

`dio: ^5.7.0` thêm vào `pubspec.yaml`.

**BookDetail**: `GET /stories/:slug` → book + chapters (badge theo `accessType`). **Reader**:
nạp detail → tìm chương theo số → `GET /chapters/:id/public` lấy `content`; chương chỉ có
audio / khoá / lỗi → dùng text demo. `Chapter.id` thêm vào model để gọi chapter API.

**Auth (token) — cơ chế mobile**: BE trả `access_token` trong body (bọc `{data}`) và
`refresh_token` qua **Set-Cookie**. Mobile đọc refresh từ Set-Cookie khi login → lưu
`flutter_secure_storage` → gửi lại header `x-refresh-token` khi `/auth/refresh` (BE nhận cả
header). ApiClient tự refresh 1 lần khi gặp 401 rồi retry. Khôi phục phiên lúc mở app:
`AuthNotifier.restore()` → `/auth/me`.

**Audio — cơ chế mobile (đã đổi sang `just_audio` + HLS):**
- Engine = **`just_audio`** (ExoPlayer/media3 Android) thay audioplayers → phát HLS native.
- **Ưu tiên HLS**: nếu asset có `hlsUrl` (m3u8 Cloudflare, đã transcode) → phát thẳng bằng
  `AudioSource.uri` (kèm header `Authorization: Bearer` để key/segment trả phí qua được).
- **Preload ~30s** (giống web FE hls.js maxBufferLength=30): `AudioLoadConfiguration`
  (Android minBuffer 15s/maxBuffer 40s/bufferForPlayback 2s; iOS preferredForwardBuffer 30s)
  → start nhanh (~2s) + buffer trước 30s, chống lag.
- **Fallback MP3**: chưa có HLS → MP3 qua `LockCachingAudioSource` (tải dần + cache đĩa →
  phát nhanh, nghe lại tức thì) hoặc proxy 302 (`/chapters/:id/audio`, chương truyện chưa có hlsUrl).
- **Preload bài kế** (nhạc): playlist `ConcatenatingAudioSource` → just_audio buffer sẵn bài tiếp.
- Token cho HLS: `AppState.tokenProvider = () => apiClient.accessToken` (wire ở main).

> Lưu ý: `hlsUrl` chỉ có khi BE worker đã transcode xong (enqueue HLS). Chưa transcode →
> app tự dùng MP3 (vẫn nhanh nhờ cache + buffer 30s).

CÒN LẠI theo cùng pattern: Trending, charts/album nhạc; đăng ký/verify UI; đồng bộ Pulse sau
unlock (`AuthNotifier.refreshUser`); billing (Pulse/VND); cache danh sách (hive); `just_audio_background`
(điều khiển màn khoá / phát nền).

═══════════════════════════════════════════════════════════════════════
## 4c. NGÔN NGỮ NỘI DUNG (content language) & I18N
═══════════════════════════════════════════════════════════════════════

Hai thứ ĐỘC LẬP:
- **Ngôn ngữ hiển thị (UI/i18n)** — `AppState.uiLang` → `Locale` của MaterialApp; chuỗi ở
  `lib/l10n/*.arb`. Xem [`lib/l10n/README.md`](../lib/l10n/README.md).
- **Ngôn ngữ nội dung** — `AppState.contentLang` (mặc định `en`, lưu máy). Gửi tham số:
  - `stories/explore` → `lang=<contentLang>` ; `stories/categories` → `language=<contentLang>`.
  - Đổi contentLang → Discover/Home reload; cache tách theo ngôn ngữ (`cache.stories.explore.<lang>`).

⚠ **AUDIO (Music) KHÔNG theo ngôn ngữ nội dung.** BE `Music` model **không có `languageId`**,
`/music` không nhận `lang` → nhạc hiện bất kể contentLang (chọn EN vẫn thấy nhạc VN). Muốn lọc:
cần BE thêm `Music.languageId` + migration/backfill + `MusicQueryDto.lang` + filter, rồi app
gửi `lang` ở `MusicRepository.list` + `MusicNotifier` truyền `contentLang`.

Backend: stories + categories có `languageId` (lọc `lang`); nếu không gửi `lang` → BE trả TẤT CẢ
ngôn ngữ trộn lẫn. Web `[lang]` gộp UI+nội dung theo URL root. Xem `../backend/docs/10-mobile-api.md`.

═══════════════════════════════════════════════════════════════════════
## 5. THỨ TỰ TRIỂN KHAI GỢI Ý
═══════════════════════════════════════════════════════════════════════

1. `ApiClient` + config base URL + unwrap envelope + 1 endpoint thử (`/stories/explore`).
2. Auth (login/verify/refresh + secure storage) → `AppState.auth`.
3. Repository `stories` + đổi Home/Discover sang async + skeleton loading.
4. Audio: đổi `Song.url` sang proxy/HLS (`just_audio` nếu cần HLS) + buffering state.
5. Billing: coin packs + membership (map Pulse/VND) — bám luồng BE.
6. Cache (hive + TTL) + offline mở app.
7. Bỏ dần `Demo` (giữ làm fixture cho test/preview).

> Giữ API public của `AppState` ổn định khi tích hợp để màn hình ít phải sửa
> (xem [03 §6](03-state-va-store.md)).
