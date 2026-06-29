# Brainstorm — HLS (m3u8) audio: AES-128 + BullMQ + R2

- **Date:** 2026-06-29
- **Project:** `audio-stories-project-all/be` (NestJS 11 + Prisma 6/MySQL + Cloudflare R2)
- **Status:** APPROVED — ready for `/ck:plan`
- **Modes:** none (no `--html`/`--wiki`)

## 1. Problem statement & requirements

Audio hiện phát mp3 thẳng từ R2 (URL public lưu DB). Cần triển khai HLS (m3u8) "thật chuẩn", test chuẩn local trước, đảm bảo phát mượt + bảo vệ nội dung trả phí.

**Quyết định đã chốt (qua hỏi đáp):**
- Scope: **full production**, áp dụng cho **tất cả entity có audio**: `Chapter`, `ChapterVariant`, `Music`, `Advertisement`.
- Format: **single-rendition AAC-LC trong MPEG-TS** (không ABR, không fMP4). Segment ~10s, VOD.
- Bảo vệ: **AES-128 encryption** + key endpoint có auth (tái dùng unlock/VIP).
- Async: **BullMQ trên Redis** (đã có Redis), chạy ở role `worker`.
- MP3 gốc: **giữ song song** mp3 + HLS (backward-compat, rollback dễ).
- Dữ liệu: **chỉ data mới** (enqueue khi tạo/sửa entity); không backfill data cũ.

### Acceptance criteria ("chuẩn")
- `ffprobe` xác nhận codec audio = AAC-LC.
- Playlist đúng tag: `#EXTM3U`, `#EXT-X-VERSION`, `#EXT-X-TARGETDURATION`, `#EXT-X-KEY:METHOD=AES-128`, `#EXT-X-ENDLIST`.
- Phát mượt + seek hoạt động trên hls.js + ffplay/VLC.
- Key endpoint: free → 200; paid chưa unlock → 403; đã unlock/VIP → 200.
- Job enqueue → status `ready` → entity response trả `hlsUrl`.

### Scope boundary (OUT)
- Không ABR/multi-bitrate, không fMP4/CMAF.
- Không backfill audio cũ trong DB.
- Không xoay/rotate key, không DRM (Widevine/FairPlay).
- Không bỏ mp3 gốc.

## 2. Codebase findings (touchpoints)

- `src/upload/audio-upload.service.ts`, `upload.controller.ts` — upload mp3 → R2, trả `{url}`. Upload **decoupled** với entity (entity tạo sau, tham chiếu url).
- `src/chapters/*`, `src/chapters/chapter-variants/*`, `src/music/*`, `src/ads/*` — nơi tạo/sửa entity có audio → điểm enqueue.
- `prisma/schema.prisma` — `Chapter.audioUrl/r2AudioUrl`, `ChapterVariant.audioUrl/r2AudioUrl`, `Music.audioUrl`, `Advertisement.audioUrl`. Có `UserUnlockedVariant`, VIP tier, accessType → logic auth tái dùng.
- `src/shared/config/app-config.schema.ts` — config R2 (`R2_*`), thêm `HLS_MASTER_KEY` + tham số HLS ở đây.
- `scripts/dev-role.cjs` — role `api/worker/scheduler` (worker đang trống); `main.ts` chưa branch theo `APP_ROLE`.
- `Dockerfile` — runtime `node:24.16.0-slim`, **chưa có ffmpeg** → phải thêm.
- Không có BullMQ, không ffmpeg lib, không ServeStatic. ffmpeg/ffprobe có sẵn trên máy local.

## 3. Approaches đã cân nhắc

| Quyết định | Chọn | Loại bỏ (lý do) |
|---|---|---|
| Trigger transcode | Async BullMQ/worker | Sync API (block, timeout); DB-job+poll (reinvent queue) |
| Format | AAC-LC/TS single | ABR (overkill audio, x3 chi phí); fMP4 (phức tạp, lợi ích nhỏ) |
| Bảo vệ | AES-128 + key authed | Public segment (đoán URL = bypass) |
| MP3 gốc | Giữ song song | Chỉ HLS (phá client cũ, khó rollback) |
| Schema | Bảng polymorphic `HlsAsset` | Cột rời trên 4 entity (lặp, khó query trạng thái) |

## 4. Giải pháp chốt

**Insight:** AES-128 cho phép segment public trên R2/CDN vẫn an toàn (vô dụng nếu thiếu key). Chỉ gate 1 key endpoint bằng logic unlock/VIP sẵn có. Player: segment ← R2 (nhanh/rẻ), key ← API (authed).

### Module `src/hls/`
- `hls-transcode.service.ts` — wrap ffmpeg (pipeline validate ở phase 0).
- `hls.processor.ts` — BullMQ worker queue `hls-transcode`, active khi `APP_ROLE=worker`.
- `hls-queue.service.ts` — producer enqueue.
- `hls-key.service.ts` — sinh key 16-byte/asset, wrap at-rest bằng `HLS_MASTER_KEY` (AES-256-GCM), `authorizeKeyAccess()`.
- `hls.controller.ts` — `GET /hls/:assetType/:assetId/key` (authed, fail-closed 403).

### Pipeline ffmpeg
```
ffmpeg -i input.mp3 -vn -c:a aac -b:a 128k -ac 2 -ar 44100 \
  -hls_time 10 -hls_playlist_type vod -hls_segment_type mpegts \
  -hls_key_info_file <keyinfo> -hls_segment_filename 'seg_%03d.ts' index.m3u8
```
`keyinfo` (3 dòng): URI key endpoint API · file key tạm · IV hex.

### Schema `HlsAsset`
`{ id, assetType(enum chapter|variant|music|ad), assetId, status(pending|processing|ready|failed), playlistUrl, encKey(wrapped blob), iv, durationSec, error?, createdAt, updatedAt, @@unique([assetType, assetId]) }`. Entity response thêm `hlsUrl` khi `ready`; mask khi locked.

### Storage
Local `uploads/hls/<assetType>/<assetId>/` (test) → production R2 `audio/hls/<assetType>/<assetId>/`. Segment URI tương đối; **key URI tuyệt đối** trỏ API.

## 5. Phases

| Phase | Nội dung | Verify |
|---|---|---|
| 0 — Local validation | `scripts/hls/transcode-local.mjs` + trang hls.js test, HLS mã hoá từ mp3 mẫu | ffprobe AAC-LC; phát+seek ffplay/VLC/hls.js; tag playlist đúng |
| 1 — Schema + key | Migration `HlsAsset`; key gen + wrap at-rest | unit wrap/unwrap; migration sạch |
| 2 — Queue + worker | `bullmq`; processor wrap pipeline P0; upload R2; wire `APP_ROLE=worker`; **ffmpeg vào Dockerfile** | integration enqueue→ready, file R2 |
| 3 — Key endpoint + expose | `GET /hls/.../key` authed; entity trả `hlsUrl`; mask locked | e2e free=200, paid=403, unlocked=200 |
| 4 — Hook enqueue | Enqueue khi tạo/sửa chapter/variant/music/ad (data mới) | integration entity→job→hlsUrl |

## 6. Risks & mitigations
- **Dockerfile thiếu ffmpeg** → thêm vào apt-get runtime stage (P2). Nếu quên → prod fail.
- **`HLS_MASTER_KEY`** bắt buộc; thiếu → fail-closed (Rule 6).
- **Nhiều segment nhỏ trên R2** (50–200 file/audio dài) → nhiều PutObject/chi phí; chấp nhận với `hls_time=10`.
- **Role split BullMQ**: producer mọi nơi, processor chỉ worker → guard `APP_ROLE`.
- **Mask `hlsUrl`** khi locked (cho nhất quán dù key đã gate).

## 7. Success metrics
- 100% acceptance criteria (§1) pass.
- Job p95 transcode < ~30s cho file ~10MB.
- Key endpoint 0 rò rỉ (paid chưa unlock luôn 403).

## 8. Next steps / dependencies
- Deps mới: `bullmq` (+ ffmpeg binary trong image). Phase 0 không cần dep.
- Env mới: `HLS_MASTER_KEY`, tham số HLS (bitrate/segment time) trong app-config.
- Handoff → `/ck:plan` (mode `--tdd`: scope đụng billing/unlock/VIP nhạy cảm, nên khoá behavior bằng test trước).

## Unresolved questions
- Điểm enqueue chính xác: khi **tạo entity** (chapter/variant/music/ad có `audioUrl`) — xác nhận ở phase plan từng controller/service.
- Key URI base trong playlist dùng env `APP_URL`/`API_BASE_URL` nào — xác nhận khi đọc config ở plan.
