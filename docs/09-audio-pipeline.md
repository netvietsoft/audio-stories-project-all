# 09 · Luồng xử lý Audio (upload, lưu trữ, phát, preload, HLS, R2/Cloudflare)

> Cập nhật 2026-06-29. Rà trực tiếp từ code (`be/src/upload`, `be/src/chapters`, FE `components/player`).
> Mục tiêu: làm rõ HIỆN TRẠNG audio + ghi lại điểm để bạn KẾT NỐI server xử lý (Python/HLS/R2) của bạn.

═══════════════════════════════════════════════════════════════════
## TL;DR — trạng thái hiện tại  (CẬP NHẬT 2026-06-29: HLS ĐÃ CHẠY THẬT)
═══════════════════════════════════════════════════════════════════
- **HLS AES-128 ĐÃ TRIỂN KHAI ĐẦY ĐỦ bằng TypeScript** trong `be/src/hls/` (HLS của team,
  KHÔNG dùng Python). Transcode bằng **ffmpeg gọi qua Node `execFile`** trong vai **worker**
  (BullMQ queue `hls-transcode`). Đã verify end-to-end: 1 track music → 103 segment 3s, m3u8 +
  key AES-128, upload R2, `/music` trả `hlsUrl`. (Mô tả "CHƯA có HLS / cần Python" bên dưới là
  LỊCH SỬ — giữ lại để đối chiếu; phần luồng MP3 vẫn đúng và là fallback.)
- **Audio gốc vẫn là MP3 trên R2** (upload qua S3 SDK), giữ nguyên làm **fallback** + nguồn để
  transcode lại. FE ưu tiên `hlsUrl` (hls.js / native HLS Safari), không có/không hỗ trợ → phát MP3.
- **Luồng HLS thật**: upload MP3 → R2 → `registerAsset` (upsert HlsAsset pending + wrap key AES,
  enqueue BullMQ) → worker tải MP3 về temp → ffmpeg cắt HLS mã hoá → upload segment+playlist lên
  `audio/hls/{type}/{id}/{runId}/` (versioned) → HlsAsset `ready` + `playlistUrl` → `/music` expose
  `hlsUrl` (chỉ khi ready + đủ quyền). hls.js fetch khoá AES qua `GET /hls/:type/:id/key` (entitlement).
- ffmpeg/ffprobe: cấu hình qua `FFMPEG_PATH` / `FFPROBE_PATH` (mặc định `ffmpeg`/`ffprobe` = PATH
  trên VPS Linux; local Windows trỏ tới bản portable). Segment dài `HLS_SEGMENT_SECONDS` (đang 3s).
- `r2AudioUrl` + `InternalApiKeyGuard` (CHƯA DÙNG): vết tích thiết kế cũ định cắm worker Python
  NGOÀI repo — **đã bỏ**, thay bằng worker TS nội bộ ở trên.

═══════════════════════════════════════════════════════════════════
## 1. LUỒNG HIỆN TẠI (đã có trong code)
═══════════════════════════════════════════════════════════════════

### 1a. Upload audio (admin) → R2
- Endpoint: `POST /upload/audio`  (guard: JwtAccessGuard + RolesGuard `ADMIN`)
  - Code: `be/src/upload/upload.controller.ts` (uploadAudio)
  - multipart field `file`; max **500MB** (2026-06-29, trước 100MB); mimetype `audio/*`; body `folder` = `chapters | bgm | music`.
  - LƯU Ý route upload nhạc thật mà admin dùng là **POST/PATCH `/music`** (multipart `audioFile`+`thumbnailFile`,
    `MUSIC_INTERCEPTOR` memoryStorage, limit **500MB**, trước 120MB) — multer trả "File too large" nếu vượt.
    memoryStorage giữ file trong RAM; muốn lớn hơn nữa nên chuyển stream/disk + multipart R2. Prod: nới nginx client_max_body_size.
  - Trả về: `{ url: "<R2 public url>" }`
- Đẩy lên R2: `be/src/upload/audio-upload.service.ts`
  - Dùng **@aws-sdk/client-s3** `PutObjectCommand` (R2 tương thích S3).
  - Key file: `audio/<folder>/<timestamp>-<uuid>.<ext>` (map trong `R2_UPLOAD_FOLDERS`):
    chapters→`audio/chapters`, bgm→`audio/bgm`, music→`audio/music`, music-thumbnails→`images/music`.
  - URL trả về = `${R2_URL}/${key}` (R2_URL = public base, bỏ dấu `/` cuối).
  - Constructor BẮT BUỘC đủ: endpoint, accessKeyId, secretAccessKey, bucketName, publicBaseUrl
    (thiếu → ném `Missing required Cloudflare R2 configuration`; local đang điền GIẢ trong be/.env).
- Upload ảnh: `POST /upload/image` (≤10MB) → `image-upload.service.ts` (cùng cơ chế R2).

### 1b. Lưu link vào DB
- Admin tạo/sửa chương và GẮN url vào field:
  - `Chapter.audioUrl` và/hoặc `Chapter.r2AudioUrl` (qua DTO `create-chapter.dto.ts` / `update-chapter.dto.ts`;
    variant: `create/update-chapter-variant.dto.ts`).
  - `Music.audioUrl` (bắt buộc, VarChar 500) cho bài nhạc.
- DB: bảng `chapters` (cột `audio_url`, `r2_audio_url`), `music_tracks` (cột `audio_url`). Xem `docs/04-database.md`.

### 1c. BE serve audio (cho truyện) — proxy 302
- Endpoint: `GET /chapters/:id/audio?variantId=...`  (guard: OptionalJwtGuard, trả **302**)
  - Code: `be/src/chapters/chapters.controller.ts` (getAudio) → `chapters.service.ts` `getAudioUrl()` (≈ dòng 481).
  - Kiểm tra entitlement (free/vip/timed/ads + unlock) rồi trả `{ url }` và **302 redirect**.
  - **Ưu tiên `r2AudioUrl` > `audioUrl`** (r2 là bản đã đẩy CDN). BE KHÔNG buffer/transcode.
  - `audioUrl`/`r2AudioUrl` bị OMIT khỏi JSON public (detail/list) → client BẮT BUỘC gọi proxy này.
- Nhạc: KHÔNG qua proxy — FE dùng thẳng `Music.audioUrl` từ API.

### 1d. FE nhận & phát (chỉ phát, không xử lý)
- Player toàn cục: `fe/apps/web/src/components/player/GlobalPlayer.tsx`
  - `const audio = new Audio(); audio.preload = "metadata";` (chỉ tải metadata/thời lượng).
  - Đổi bài: `audio.src = currentTrack.audioUrl; audio.load();` → `audio.play()`.
  - Tua (seek): dựa **HTTP Range** của host. Đã test mp3 demo: `206 Partial Content` + `Accept-Ranges: bytes` (OK).
  - **KHÔNG preload bài kế tiếp**, KHÔNG hls.js/dash/shaka (đã grep: không có thư viện nào).
- Ghi nhận play/history: `fe/apps/web/src/lib/music/music-interactions.ts` + `POST /music/:id/play`,
  `POST /music/interactions/:musicId/history`.

═══════════════════════════════════════════════════════════════════
## 2. PRELOAD — đã có tới đâu?
═══════════════════════════════════════════════════════════════════
- CÓ: `preload="metadata"` (chỉ metadata) + progressive streaming khi play (browser tự tải dần qua Range).
- CHƯA có: preload/prefetch **bài kế tiếp** trong hàng đợi → chuyển bài có độ trễ tải lại.
- Muốn mượt: thêm 1 `<audio preload="auto">` ẩn cho next track (queue ở store nhạc), hoặc dùng MediaSource.

═══════════════════════════════════════════════════════════════════
## 3. HLS / m3u8 — CHƯA có. Cần gì để bật
═══════════════════════════════════════════════════════════════════
Hoàn toàn chưa triển khai. Để có HLS adaptive (hợp audiobook dài, tua nhanh, tiết kiệm băng thông):
1. **Tầng xử lý (server của bạn — Python?)**: ffmpeg băm audio → `playlist.m3u8` + segment `.aac/.ts`,
   upload toàn bộ lên R2 (giữ cùng prefix), rồi trả URL `.m3u8`.
2. **BE**: lưu URL `.m3u8` vào `Chapter.r2AudioUrl` (hoặc thêm cột `hlsUrl`). Proxy 302 vẫn dùng được.
3. **FE**: thêm `hls.js`. Safari phát HLS native; Chrome/Firefox cần:
   `if (Hls.isSupported()) { const hls = new Hls(); hls.loadSource(url); hls.attachMedia(audio); }`
   else `audio.src = url`. Sửa trong `GlobalPlayer.tsx`.

═══════════════════════════════════════════════════════════════════
## 4. KẾT NỐI SERVER XỬ LÝ NGOÀI (Python băm file → R2 → báo BE)
═══════════════════════════════════════════════════════════════════
> Theo trí nhớ của bạn: có 1 server Python băm file rồi đẩy R2, trả link cho BE lưu DB, FE đọc từ DB.
> Trong REPO NÀY **không có** server đó (nó là dịch vụ riêng). Nhưng BE đã có sẵn 2 điểm móc nối:

- **Điểm móc 1 — `InternalApiKeyGuard`** (`be/src/auth/guards/internal-api-key.guard.ts`):
  kiểm header `x-internal-api-key` == env `INTERNAL_API_KEY`. HIỆN **CHƯA gắn vào endpoint nào**
  (đã viết nhưng chưa dùng). Đây là guard dành cho server-to-server (Python → BE).
- **Điểm móc 2 — field `r2AudioUrl`** trên `chapters` (và `audioUrl` trên `music_tracks`):
  nơi lưu URL bản đã xử lý/đẩy CDN.

**Cách cắm lại (2 lựa chọn):**
- (A) Python set trực tiếp qua API admin có sẵn: `PATCH /chapters/:id` (hoặc `/music/:id`) với token ADMIN,
  body `{ r2AudioUrl: "<...m3u8 hoặc mp3 trên R2>" }`. KHÔNG cần code mới.
- (B) (khuyến nghị) Tạo endpoint callback nội bộ mới, bảo vệ bằng `InternalApiKeyGuard`, vd
  `POST /internal/chapters/:id/audio-ready` body `{ url, duration }` → cập nhật `r2AudioUrl`+`audioDuration`.
  Python gọi với header `x-internal-api-key: <INTERNAL_API_KEY>`. (Cần viết controller mới — CHƯA có.)

═══════════════════════════════════════════════════════════════════
## 5. CẤU HÌNH R2 / CLOUDFLARE (env) — để kết nối
═══════════════════════════════════════════════════════════════════
File: `be/.env` (mẫu `be/.env.example`); schema kiểm tra: `be/src/shared/config/app-config.schema.ts` (mục `storage`).
```
STORAGE_PROVIDER=r2            # r2 | s3 | uploadthing
R2_TOKEN=                      # Cloudflare R2 API token
R2_ACCOUNT_ID=                 # Cloudflare account id
R2_ACCESS_KEY_ID=             # R2 S3 access key
R2_SECRET_ACCESS_KEY=         # R2 S3 secret
R2_BUCKET_NAME=audio-stories-dev
R2_ENDPOINT=                  # https://<accountid>.r2.cloudflarestorage.com  (S3 endpoint)
R2_URL=                       # public base URL để FE tải (custom domain hoặc r2.dev). LƯU Ý: bucket có
                              #   dấu '_' bị R2 từ chối (xem mục 4.5 first_readme).
# fallback S3 (nếu STORAGE_PROVIDER=s3):
AWS_ACCESS_KEY_ID=  AWS_SECRET_ACCESS_KEY=  AWS_REGION=ap-southeast-1  AWS_BUCKET_NAME=
UPLOADTHING_TOKEN=            # nếu STORAGE_PROVIDER=uploadthing
INTERNAL_API_KEY=             # dùng cho InternalApiKeyGuard (server Python gọi BE)
```
> LOCAL hiện điền GIÁ TRỊ GIẢ cho R2_* để BE boot (không upload thật). Khi nối R2 thật: điền đủ
> R2_ENDPOINT + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET_NAME + R2_URL (public).
> Cloudflare cần: bật **R2 public access / custom domain** cho R2_URL; CORS cho phép origin FE
> (GET, header Range) để tua được; (tuỳ) cache rule cho audio.

### Cấu hình R2 THẬT của dự án (giá trị non-secret để dễ tìm; KEY/SECRET nằm trong env, ĐÃ gitignore)
- File env thật: **`env/be/*.env` và `env/be/*.env.prod`** (đã thêm `.gitignore` — KHÔNG commit).
- `STORAGE_PROVIDER=r2` · `R2_BUCKET_NAME=audio-truyen-r2`
- `R2_URL` (public, FE tải) = `https://pub-12f4b9a768704460a78aa2efa178852d.r2.dev`
- `R2_ENDPOINT` = `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` (account id trong env)
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_TOKEN`: xem env/be (KHÔNG in ra log/commit).
- S3 fallback bucket: `netviet-audio` (AWS ap-southeast-1). `UPLOADTHING_TOKEN`: live (trong env).
- `INTERNAL_API_KEY`: prod hiện = placeholder `CHANGE_ME...` (chưa đặt thật) → server Python chưa có khoá để gọi BE.

> ⚠️ DỮ LIỆU AUDIO HIỆN TẠI: dump đã import (`netviet_audio`) dùng audio **PLACEHOLDER soundhelix.com**
> (mp3 test), KHÔNG phải audio thật trên R2. Muốn audio thật: import prod DB hoặc upload file lên
> bucket `audio-truyen-r2` rồi gắn URL vào `r2AudioUrl`/`audioUrl`.
> Demo Chế Linh mình thêm thì trỏ `http://localhost:3001/demo/audio/...` (file ở fe/public).

═══════════════════════════════════════════════════════════════════
## 6. BẢN ĐỒ FILE (dễ tìm)
═══════════════════════════════════════════════════════════════════
| Việc | File |
|------|------|
| Endpoint upload audio/image | `be/src/upload/upload.controller.ts` |
| Đẩy R2 (S3 PutObject), tạo key, trả URL | `be/src/upload/audio-upload.service.ts`, `image-upload.service.ts` |
| Serve audio truyện (proxy 302, entitlement, ưu tiên r2AudioUrl) | `be/src/chapters/chapters.controller.ts` (getAudio) + `chapters.service.ts` (getAudioUrl ~481) |
| Field lưu URL | `chapters.audio_url`/`r2_audio_url`, `music_tracks.audio_url` (schema `be/prisma/schema.prisma`) |
| DTO gắn URL khi tạo/sửa | `be/src/chapters/dto/*chapter*.dto.ts` |
| Guard server-to-server (chưa dùng) | `be/src/auth/guards/internal-api-key.guard.ts` |
| Cấu hình storage/R2 | `be/.env`, `be/src/shared/config/app-config.schema.ts` |
| Player FE (native audio, preload, seek) | `fe/apps/web/src/components/player/GlobalPlayer.tsx` |
| Ghi play/history FE | `fe/apps/web/src/lib/music/music-interactions.ts` |
| Audio demo local (mp3 Chế Linh) | `fe/apps/web/public/demo/audio/` (audioUrl = http://localhost:3001/demo/audio/...) |

═══════════════════════════════════════════════════════════════════
## 6b. KIẾN TRÚC MỤC TIÊU — ASYNC HLS PIPELINE (yêu cầu của owner)
═══════════════════════════════════════════════════════════════════
Luồng mong muốn (transcode bất đồng bộ, phát HLS):
  1) Upload MP3 -> R2 bucket "original"
  2) Ghi DB status = uploaded
  3) Đẩy job vào queue
  4) Worker/VPS lấy job
  5) Download MP3 từ R2 (original)
  6) FFmpeg convert -> HLS (.m3u8 + segment)
  7) Upload HLS -> R2 bucket public/private
  8) Update DB status = ready
  9) App lấy link .m3u8 để phát

GAP (hiện trạng vs mục tiêu) — tính đến 2026-06-29:
  | Bước | Trạng thái | Ghi chú |
  |------|-----------|---------|
  | 1 Upload MP3 -> R2 | ✅ CÓ | POST /upload/audio + music form (audioFile) -> audioUploadService.uploadAudio. Hiện CHỈ 1 bucket (audio-truyen-r2), CHƯA tách "original". |
  | 2 DB status=uploaded | ❌ THIẾU | Music/Chapter KHÔNG có cột status xử lý audio (chỉ có Story.status, Payment.status...). Cần thêm: audioStatus enum (uploaded|queued|processing|ready|failed) + hlsUrl + originalKey + jobId. |
  | 3 Queue job | ❌ THIẾU | KHÔNG có BullMQ/queue trong be/src. Redis đã có (6379) nhưng BullModule chưa wire. |
  | 4 Worker lấy job | ❌ THIẾU | APP_ROLE=worker tồn tại nhưng RỖNG (chưa import BullModule, chưa consumer). |
  | 5 Download từ R2 | ❌ THIẾU | Worker logic chưa có (GetObject từ bucket original). |
  | 6 FFmpeg -> HLS | ❌ THIẾU | KHÔNG có ffmpeg trong repo. Đây là "server băm" — chọn: (A) Node worker trong repo (ffmpeg-static + fluent-ffmpeg) hoặc (B) service Python riêng. |
  | 7 Upload HLS -> R2 | ❌ THIẾU | PutObject nhiều file (.m3u8 + .ts/.aac) vào bucket public. |
  | 8 Update DB status=ready | ❌ THIẾU | Worker (in-repo) update trực tiếp, HOẶC service ngoài gọi callback BE (InternalApiKeyGuard) set hlsUrl + status=ready. |
  | 9 App phát .m3u8 | ❌ THIẾU | FE chưa có hls.js. GlobalPlayer phát mp3 progressive; cần thêm Hls.isSupported() -> hls.loadSource(hlsUrl). |

ĐÃ TRIỂN KHAI (2026-06-29) — BƯỚC 1–3 cho MUSIC (producer phía BE):
  - Schema: thêm vào `music_tracks`: `audio_status` (enum AudioStatus: none|uploaded|processing|ready|failed),
    `original_audio_key` (R2 key của file gốc), `hls_url`. (Áp bằng `prisma db push`.)
  - Upload Single + file (POST/PATCH /music multipart `audioFile`) -> uploadAudio lên R2 (prefix audio/music/)
    -> set `audio_status='uploaded'`, `original_audio_key=<key>` -> ĐẨY job vào Redis.
  - Queue (Redis LIST): key **`audio:transcode:jobs`**, job JSON:
    `{ type:'music', id, audioUrl, originalKey, bucket, enqueuedAt }`
  - Code: be/src/audio-pipeline/audio-queue.service.ts (producer) + music.service.ts (hook trong create).
    (CHỈ áp cho contentType single/podcast + có file upload; playlist/URL ngoài -> audio_status='none', không enqueue.)
    (CHƯA làm cho CHAPTER và cho music.update — sẽ mở rộng tương tự khi cần.)

HỢP ĐỒNG CHO PYTHON WORKER (bước 4–8 — bạn tự chạy ngoài repo):
  1. BRPOP queue:   raw = r.brpop("audio:transcode:jobs");  job = json.loads(raw[1])
  2. (tuỳ) set processing:  UPDATE music_tracks SET audio_status='processing' WHERE id=job["id"]
  3. Download gốc từ R2 bằng job["originalKey"] + job["bucket"] (S3 creds R2 trong env/be).
  4. ffmpeg -> HLS (aac, segment ~6-10s, master.m3u8).
  5. Upload thư mục HLS lên R2 (vd prefix audio/hls/<id>/...). 
  6. Cập nhật DB khi xong (1 trong 2 cách):
     - Trực tiếp: UPDATE music_tracks SET audio_status='ready', hls_url='https://pub-…r2.dev/audio/hls/<id>/master.m3u8' WHERE id=job["id"]
     - Hoặc gọi callback BE (khi BE có endpoint InternalApiKeyGuard — hiện CHƯA tạo).
  7. Lỗi -> UPDATE ... SET audio_status='failed'.
  (Bước 9 — FE phát .m3u8 — sẽ thêm hls.js sau, đọc hls_url khi audio_status='ready'.)

ĐÃ TRIỂN KHAI (2026-06-29) — BƯỚC 8 (callback worker -> BE):
  - Endpoint: `PATCH /internal/audio/:type/:id` (type='music'), guard InternalApiKeyGuard.
    Header: `x-internal-api-key: <INTERNAL_API_KEY>`. Body: `{ status, hlsUrl?, audioDuration? }`
    (status: processing|ready|failed; ready BẮT BUỘC hlsUrl). -> update music_tracks.audio_status/hls_url/audio_duration.
  - Code: be/src/audio-pipeline/internal-audio.controller.ts + audio-pipeline.module.ts (đăng ký AppModule).
  - Đã verify: 401 không key; 200 + DB cập nhật khi có key. (/music & /music/:slug đã trả hls_url + audio_status.)

==> THÔNG TIN VPS WORKER CẦN ĐỂ KẾT NỐI (đưa cho người dựng Python):
  1) REDIS (lấy job - bước 4): host/port/password của Redis BE đang dùng.
     - LOCAL hiện: 127.0.0.1:6379 (no password) — chỉ truy cập từ máy local. Muốn VPS lấy job phải
       cho VPS TỚI ĐƯỢC Redis: hoặc Redis prod có public host+password, hoặc SSH tunnel, hoặc đổi sang
       Redis chung. (Local portable redis bind localhost -> VPS NGOÀI không vào được.)
     - Key queue: `audio:transcode:jobs` (LIST, BRPOP). Job JSON: {type,id,audioUrl,originalKey,bucket,enqueuedAt}.
  2) R2 (download gốc + upload HLS - bước 5,7): R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
     R2_BUCKET_NAME (novel-audio), R2_URL (public). Lấy từ env/be (KHÔNG commit).
  3) BE CALLBACK (bước 8): URL gốc BE + INTERNAL_API_KEY.
     - LOCAL: http://localhost:3000  (VPS ngoài KHÔNG gọi được localhost — cần BE có public URL/tunnel).
     - PROD: https://bemedscan.foodsnear.me (theo env prod).
     - Header `x-internal-api-key`. Hiện local INTERNAL_API_KEY=local-dev-internal-api-key; PROD đang để
       placeholder CHANGE_ME -> PHẢI đặt key thật (openssl rand -hex 16) + cho VPS dùng cùng key.
  >> "thông tin cổng" cần chốt: (a) Redis endpoint VPS truy cập được, (b) BE public URL cho callback,
     (c) INTERNAL_API_KEY chung. Nếu test local: chạy worker trên CÙNG máy (localhost) là đủ.

CÁC QUYẾT ĐỊNH CẦN CHỐT TRƯỚC KHI BUILD:
  - D1. Worker transcode: (A) Node BullMQ worker TRONG repo (APP_ROLE=worker) hay (B) service Python RIÊNG?
        (A) tận dụng 3-role sẵn có + Redis; (B) khớp trí nhớ cũ, cắm qua queue + callback InternalApiKeyGuard.
  - D2. Bucket: 1 bucket nhiều prefix (audio/original, audio/hls) hay 2 bucket (original riêng, public riêng)?
        Hiện chỉ có 1 bucket audio-truyen-r2 (public r2.dev).
  - D3. Lưu HLS public hay private+signed? (public r2.dev đơn giản; private cần signed URL/proxy.)
  - D4. Đối tượng áp dụng: music, chapter, hay cả hai? (cả 2 đều cần audioStatus + hlsUrl.)

ĐỀ XUẤT TRIỂN KHAI (nếu chọn A — Node worker in-repo, ít hạ tầng nhất):
  1. Schema: thêm vào Music & Chapter: audioStatus (enum), hlsUrl, originalAudioKey, audioJobId. + migration.
  2. Queue: cài bullmq; tạo AudioQueueModule (queue "audio-transcode") dùng Redis sẵn có.
  3. Enqueue: sau upload (api role) -> set status=uploaded + add job { type:'music'|'chapter', id, originalKey }.
  4. Worker (APP_ROLE=worker): BullMQ Worker -> download original từ R2 -> ffmpeg-static convert HLS
     (aac, segment 6-10s, master.m3u8) -> upload thư mục HLS lên R2 prefix audio/hls/<id>/ -> update DB
     status=ready + hlsUrl=<.../master.m3u8>. Lỗi -> status=failed + log.
  5. FE: thêm hls.js vào GlobalPlayer (cả web + admin nếu cần). Nếu status!=ready -> phát mp3 gốc/chờ.
  (Nếu chọn B — Python: BE chỉ cần (a) cột status/hlsUrl, (b) enqueue hoặc để Python poll DB status=uploaded,
   (c) endpoint callback POST /internal/audio/:type/:id/ready (InternalApiKeyGuard) set hlsUrl+status.)

═══════════════════════════════════════════════════════════════════
## 7. VIỆC CÒN THIẾU / TODO nếu muốn pipeline đầy đủ
═══════════════════════════════════════════════════════════════════
- [ ] Server xử lý (Python) băm HLS + đẩy R2 — nằm NGOÀI repo, cần bạn cung cấp/cắm lại.
- [ ] BE: endpoint callback `InternalApiKeyGuard` để Python báo URL (mục 4-B) — CHƯA có.
- [ ] (tuỳ) cột `hlsUrl` riêng + `audioDuration` tự điền từ pipeline.
- [ ] FE: thêm `hls.js` trong GlobalPlayer để phát `.m3u8` (mục 3).
- [ ] FE: preload bài kế tiếp (mục 2).
- [ ] R2 thật + custom domain + CORS Range (mục 5).
