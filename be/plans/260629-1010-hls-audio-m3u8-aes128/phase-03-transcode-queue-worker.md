---
phase: 3
title: "Transcode Queue & Worker"
status: done
effort: ""
---

# Phase 3: Transcode Queue & Worker

## Overview
Cơ chế transcode async end-to-end: BullMQ queue + worker processor wrap pipeline ffmpeg (đã validate Phase 1), upload output lên R2, cập nhật `HlsAsset`. Thêm `ffmpeg` vào Docker runtime.

## Requirements
- Functional: nhận job `{ assetType, assetId, sourceUrl, hlsAssetId }` → tải mp3 nguồn → transcode AES-128 (key từ `HlsKeyService`) → upload playlist+segments lên R2 → set `status=ready`, `playlistUrl`, `durationSec`. Lỗi → `status=failed` + `error`.
- Non-functional: processor **chỉ chạy khi `APP_ROLE=worker`**; producer chạy mọi role; retry/backoff; concurrency giới hạn; dọn thư mục tạm.

## Architecture
- Dep mới: `bullmq` (+ `@nestjs/bullmq` để DI sạch).
- **Redis isolation (red-team H4):** BullMQ **không** dùng chung namespace với CacheModule (cùng `REDIS_URL`, `app.module.ts:49-59`). Cấu hình `connection` với **`keyPrefix: 'hls-bull:'`** (hoặc Redis `db` index riêng nếu provider cho phép). Tài liệu hoá eviction policy: queue Redis không được `allkeys-lru` evict job keys.
- **Worker bootstrap (red-team C5 — BLOCKER):** trước khi code, **đọc `src/bootstrap.ts` (~144 `createApplicationContext`), `src/main.ts`, `src/shared/kernel/app-role.util.ts`, `ecosystem.config.js`, `deploy.sh`** để xác nhận: role `worker` khởi tạo Nest context nào và liệu `@nestjs/bullmq` processor (cần lifecycle `onModuleInit`) có thực sự được khởi động trong context đó. Nếu worker dùng `createApplicationContext` (không HTTP), phải đảm bảo `HlsModule` nằm trong module graph của context worker và `Worker` của BullMQ được `.run()`/khởi động. **Success criteria phải verify job thật được consume**, không chỉ enqueue.
- `src/hls/hls.module.ts` — đăng ký queue `hls-transcode`; **conditional processor**: chỉ provide `HlsProcessor` khi `process.env.APP_ROLE === 'worker'`. Producer (`HlsQueueService`) luôn provide. Export `HlsQueueService`, `HlsKeyService`.
- `src/hls/hls-queue.service.ts` — `enqueueTranscode(payload)`; idempotent jobId = `${assetType}:${assetId}` để dedupe.
- `src/hls/hls-transcode.service.ts` — thuần hoá pipeline:
  - `transcode(sourceUrl, hlsAsset): { playlistDir, durationSec }` — tải nguồn về tmp (`fs.mkdtemp`), viết key file + keyinfo. **Key URI = `${cfg.publicApiUrl}/hls/${assetType}/${assetId}/key`** (red-team C3: từ `PUBLIC_API_URL`, KHÔNG derive từ request host vì worker không có). Spawn ffmpeg (arg list). Parse duration bằng ffprobe. `finally` xoá tmp dir.
  - **Arg builder** tách riêng (`buildFfmpegArgs(input, opts)`) để unit test.
- **Tải nguồn từ R2 (red-team H1 — repo chưa có GetObject, chỉ PutObject `audio-upload.service.ts:72`):**
  - Đầu Phase: xác định bucket public hay private (đọc `R2_URL`/`R2_*`). 
  - Private → dùng `GetObjectCommand` (S3Client) stream về tmp. Public → HTTP GET `r2AudioUrl`/`audioUrl`. **Lưu ý bảo mật:** nếu bucket public, file mp3 gốc world-readable → mâu thuẫn mục tiêu AES (raw audio đang được cố tình ẩn, `chapters.service.ts:46,83`). Ghi rõ giả định bucket.
- `src/hls/hls-r2.service.ts` — trích `S3Client` dùng chung với `AudioUploadService` (tránh khởi tạo 2 client). Upload lên `audio/hls/<assetType>/<assetId>/`.
  - **Atomic-ish upload (red-team C6):** upload **tất cả `seg_*.ts` trước** (key KHÔNG upload), **playlist `index.m3u8` upload SAU CÙNG**. Chỉ set `HlsAsset.status=ready` + `playlistUrl` sau khi playlist đã lên. Dùng **prefix versioned** `.../<assetId>/<jobRunId>/` để re-transcode không ghi đè bản đang phát (tránh race + playlist trỏ segment 404). Segment URI trong m3u8 để tương đối → resolve theo cùng prefix.
  - <!-- Updated: Validation Session 1 - V3 --> **Cleanup (V3):** sau khi bản mới `ready`, **xóa prefix versioned cũ** trên R2 (lưu prefix cũ trên `HlsAsset` trước khi ghi đè, hoặc list theo `<assetId>/` và xóa các run khác run hiện tại). Tránh phình storage.
- `src/hls/hls.processor.ts` — `@Processor('hls-transcode')`; set `processing` → transcode → upload (segments trước, playlist sau) → update `ready`. Lỗi bất kỳ → `status=failed` + `error`, KHÔNG để playlist nửa vời thành `ready`.
- **Provisioning ffmpeg (red-team H2):** prod deploy qua `deploy.sh` (SSH + PM2 + `node dist/main.js`), **không qua Docker image**. → cài `ffmpeg` trên **host thật** (thêm bước vào `deploy.sh` hoặc tài liệu provisioning host) **và** thêm vào `Dockerfile` runtime (cho môi trường container). Acceptance phải kiểm tra trên đường deploy thực tế.

## TDD (tests-first)
- `src/hls/__tests__/hls-transcode.args.spec.ts` (đỏ): `buildFfmpegArgs` chứa `-c:a aac`, `-b:a <bitrate>`, `-hls_time <sec>`, `-hls_key_info_file`, `-hls_segment_type mpegts`, `-vn`; không có chuỗi shell nội suy.
- `src/hls/__tests__/hls-queue.service.spec.ts` (đỏ): enqueue gọi `queue.add` với jobId dedupe đúng payload (mock queue).
- Integration `src/hls/__tests__/hls-transcode.int.spec.ts` (đỏ→xanh, dùng mp3 mẫu thật + ffmpeg, mock R2 upload): transcode → output có m3u8+segments mã hoá; `durationSec`>0; verify tag (tái dùng assertion Phase 1).

## Related Code Files
- Create: `src/hls/hls.module.ts`, `hls-queue.service.ts`, `hls-transcode.service.ts`, `hls-r2.service.ts`, `hls.processor.ts`, `src/hls/__tests__/*`
- Modify: `src/app.module.ts` (import `HlsModule`), `Dockerfile` (ffmpeg), `deploy.sh` / host provisioning (ffmpeg — red-team H2), `package.json` (`bullmq`, `@nestjs/bullmq`), `src/hls/hls-key.service.ts`, `src/upload/audio-upload.service.ts` (trích `S3Client` dùng chung)
- Read trước khi code (verify C5): `src/bootstrap.ts`, `src/main.ts`, `src/shared/kernel/app-role.util.ts`, `ecosystem.config.js`, `deploy.sh`

## Implementation Steps
1. **Verify worker bootstrap (C5):** đọc bootstrap/app-role/ecosystem; xác nhận processor BullMQ chạy trong context worker. Nếu không → điều chỉnh wiring trước.
2. Xác định bucket R2 public/private (H1) → chọn cách tải nguồn.
3. Thêm dep; viết specs (args, queue, integration) — đỏ.
4. Implement arg builder + transcode service (wrap pipeline Phase 1, key URI từ `PUBLIC_API_URL`).
5. Implement R2 source download (GetObject/HTTP) + upload (segments trước, playlist sau, prefix versioned).
6. Implement queue service (keyPrefix Redis) + conditional processor + module; import vào app.
7. Thêm `ffmpeg` vào Dockerfile runtime + bước provisioning host trong `deploy.sh`.
8. Chạy specs → xanh; chạy worker local (`APP_ROLE=worker`) với job tay, **xác nhận job được consume → ready**.

## Success Criteria
- [ ] Specs args/queue/integration xanh.
- [ ] **Job thật được worker CONSUME** (không chỉ enqueue) → HLS mã hoá trên R2; `status=ready`, `playlistUrl` đúng, segment URI resolve được.
- [ ] Crash giữa chừng → `status=failed`, KHÔNG có playlist `ready` trỏ segment thiếu (C6).
- [ ] Re-transcode → bản mới ready rồi prefix cũ bị xóa khỏi R2 (V3).
- [ ] Processor không active khi `APP_ROLE!=worker`; producer enqueue được ở api role.
- [ ] BullMQ Redis tách namespace (keyPrefix/db) khỏi cache (H4).
- [ ] ffmpeg có trên cả Docker runtime VÀ host deploy thật (H2).

## Risk Assessment
- **Bucket public** → mp3 gốc world-readable, mâu thuẫn AES; cân nhắc chuyển nguồn sang private hoặc chấp nhận có chủ đích (ghi rõ).
- Nhiều PutObject → giới hạn concurrency; log số segment.
- Job lớn/timeout → BullMQ `attempts`+`backoff`+`lockDuration` đủ dài; re-transcode dùng prefix mới (không đụng bản đang phát).
- Key URI trỏ endpoint Phase 4 (chưa tồn tại lúc P3) → playlist vẫn hợp lệ cú pháp; phát mã hoá thật chỉ kiểm được sau P4.
