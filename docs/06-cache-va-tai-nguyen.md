# 06 — Cache & tài nguyên (NovelVerse Flutter)

> Cache ảnh/giải mã, asset audio/cover/icon, font; + đề xuất cache khi dữ liệu lên mạng.
> Dựa trên code thật. Cập nhật: 2026-07-02.

═══════════════════════════════════════════════════════════════════════
## 1. TÀI NGUYÊN (ASSETS) HIỆN TẠI
═══════════════════════════════════════════════════════════════════════

Khai trong `pubspec.yaml` mục `flutter/assets`:

| Thư mục | Nội dung | Dùng ở |
|---|---|---|
| `assets/covers/` | bìa truyện (`rom_*`, `wolf_*`, `love_*`), nhạc (`mus_*`), chart (`top_*`) | `CoverImage` qua `Demo.*.cover` |
| `assets/icons/` | icon tab (`home.png`, `discover.png`, `trending.png`, `profile.png`) | `_BottomNav` (`Image.asset` + tô màu `BlendMode.srcIn`) |
| `assets/audio/` | nhạc demo `s0..s12.mp3`, audiobook `ep1.mp3` | `AppState.play` qua `AssetSource('audio/..')` |

> Đường dẫn cover trong `Demo` là **đường dẫn asset** (`assets/covers/x.png`). Audio
> trong `Song.url` là **path tương đối trong assets** (vd `audio/s0.mp3`), vì
> `AssetSource` đã ngầm gốc `assets/`.

═══════════════════════════════════════════════════════════════════════
## 2. CACHE HIỆN CÓ (mức framework)
═══════════════════════════════════════════════════════════════════════

1. **Cache giải mã ảnh** (`CoverImage`): `Image.asset(..., cacheWidth: 260*DPR,
   gaplessPlayback: true)`.
   - `cacheWidth`: ảnh được **giải mã ở ~kích thước hiển thị** thay vì full-res →
     giảm RAM ảnh trong `ImageCache` và giảm giật khi cuộn list/grid.
   - `gaplessPlayback`: giữ frame cũ khi ảnh đổi → không nháy trắng.
   - Flutter có sẵn **`ImageCache`** (mặc định ~100MB / 1000 ảnh) cache ảnh đã giải mã
     trong phiên — asset lặp lại không decode lại.
2. **Placeholder thay loading ảnh**: `errorBuilder` → gradient theo `title.hashCode`
   (ổn định) — vừa là empty-state vừa tránh layout shift.
3. **Font** (`google_fonts`): mặc định **tải font runtime lần đầu rồi cache vào ổ đĩa
   thiết bị** cho các lần sau. ⚠ Lần chạy đầu cần mạng; khi release nên **bundle font
   vào assets** (tải Spectral/Figtree .ttf, khai trong `pubspec.yaml fonts`, tắt fetch
   runtime) để chạy offline ổn định + không phụ thuộc Google.
4. **Audio asset**: phát thẳng từ bundle, không cần cache mạng (prototype).

═══════════════════════════════════════════════════════════════════════
## 3. ĐỀ XUẤT CACHE KHI DỮ LIỆU LÊN MẠNG
═══════════════════════════════════════════════════════════════════════

Khi cover/audio chuyển từ asset sang URL backend (R2/Cloudflare, HLS), cần cache thật:

### 3.1 Ảnh mạng (cover) — ĐÃ LÀM
- `CoverImage` dùng **`cached_network_image`** cho URL (đĩa + RAM) → cuộn lại không
  tải/giải mã lại (hết giật thumbnail); asset vẫn `Image.asset`.
- `memCacheWidth`/`maxWidthDiskCache` ~ kích thước hiển thị; `_placeholder()` gradient
  làm placeholder/errorWidget.

### 3.2 Audio / HLS — ĐÃ LÀM (`just_audio`)
- Engine đã đổi sang **`just_audio`** (ExoPlayer/media3). Ưu tiên **HLS m3u8 (Cloudflare)**
  qua `AudioSource.uri` khi asset có `hlsUrl`; chưa có → MP3 `LockCachingAudioSource`
  (tải dần + cache đĩa) hoặc proxy 302 (`/chapters/:id/audio`).
- **Preload ~30s** qua `AudioLoadConfiguration` (giống web FE hls.js); playlist
  `ConcatenatingAudioSource` để preload bài kế (nhạc).
- **Key AES-128**: gắn `Authorization: Bearer` vào `AudioSource.uri.headers` → key/segment
  trả phí qua được (ExoPlayer dùng cùng data source cho manifest/key/segment). Xem
  `AppState.tokenProvider` + [07 §audio](07-noi-backend.md).
- Còn lại: `just_audio_background` (điều khiển màn khoá / phát nền); cache HLS offline.

### 3.3 Cache lớp dữ liệu (API) — ĐÃ LÀM (stale-while-revalidate)
- `lib/data/cache/json_cache.dart` (shared_preferences + timestamp): cache JSON list
  feed **stories/explore**, **music** và **categories** kèm mốc thời gian; key tách theo
  ngôn ngữ nội dung (vd `cache.stories.explore.<lang>`, `cache.categories.<lang>`).
- Notifier: hiện **cache ngay** khi mở app → chỉ gọi backend làm mới khi cache **> TTL** /
  chưa có / ép refresh / có search → mở nhanh, offline vẫn xem được. **TTL khác nhau theo
  vùng**: `StoriesNotifier` = **1 phút** (nội dung mới lên nhanh), `MusicNotifier` = **10 phút**.
- **Fallback khác nhau**: `MusicNotifier` lỗi/tắt BE → `Demo.songs` (`usingFallback`);
  `StoriesNotifier` **không** fallback demo → tắt BE trả rỗng, lỗi giữ cache hoặc báo lỗi.
- Dữ liệu nhỏ nên prefs đủ; cần lớn/nhiều hơn → chuyển `hive` sau.

═══════════════════════════════════════════════════════════════════════
## 4. CHECKLIST KHI THÊM TÀI NGUYÊN
═══════════════════════════════════════════════════════════════════════

- [ ] Bỏ file vào `assets/<nhóm>/` và **khai thư mục** trong `pubspec.yaml` (nếu thêm
      nhóm mới) → `flutter pub get`.
- [ ] Ảnh lớn: cân nhắc nén/đúng kích thước; luôn để `CoverImage` lo `cacheWidth`.
- [ ] Audio: đặt trong `assets/audio/`, tham chiếu `url` **không kèm tiền tố `assets/`**
      (vì `AssetSource` ngầm gốc assets).
- [ ] Icon tab: PNG đơn sắc (được tô qua `BlendMode.srcIn`), 22×22 logic.
