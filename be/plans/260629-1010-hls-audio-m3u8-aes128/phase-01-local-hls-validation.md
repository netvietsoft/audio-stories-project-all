---
phase: 1
title: "Local HLS Validation"
status: done
effort: ""
---

# Phase 1: Local HLS Validation

## Overview
Chứng minh pipeline HLS "chuẩn" trên local trước khi đụng app: CLI script tạo HLS AES-128 (AAC-LC/TS) từ mp3 mẫu + trang hls.js để phát thử. Đây là **nguồn chân lý** cho lệnh ffmpeg mà Phase 3 sẽ wrap. Không phụ thuộc Nest/DB.

## Requirements
- Functional: từ mp3 mẫu sinh `index.m3u8` + `seg_*.ts` mã hoá AES-128 + `enc.key` + `keyinfo`; phát được trên hls.js và ffplay/VLC.
- **Đường dẫn mp3 mẫu (red-team M3):** nằm ở **gốc dự án**, NGOÀI `/be`: `../audio-mp3-files/Full Nếu Ta Ngược Lối - Remix #2_1.mp3` (có khoảng trắng + `#`). Script nhận path qua `process.argv` và truyền vào ffmpeg dạng **arg-list** (không nội suy chuỗi shell).
- Non-functional: lệnh ffmpeg cố định, tham số hoá (bitrate, hls_time) để Phase 3 tái dùng; script không cần dep ngoài (Node built-in + ffmpeg system).

## Architecture
- `scripts/hls/transcode-local.mjs` — Node script gọi `ffmpeg`/`ffprobe` qua `child_process`:
  1. Sinh key 16 byte (`crypto.randomBytes(16)`) → `enc.key`; IV hex (`randomBytes(16).toString('hex')`).
  2. Viết `keyinfo` 3 dòng: `key URI` (local: `enc.key` tương đối) · đường dẫn file key · IV hex.
  3. Chạy:
     ```
     ffmpeg -i <input> -vn -c:a aac -b:a 128k -ac 2 -ar 44100 \
       -hls_time 10 -hls_playlist_type vod -hls_segment_type mpegts \
       -hls_key_info_file keyinfo -hls_segment_filename 'seg_%03d.ts' index.m3u8
     ```
  4. `ffprobe` xác nhận codec=aac; in tag playlist.
- `scripts/hls/test-player.html` — hls.js (CDN) trỏ `index.m3u8`, dùng `python3 -m http.server` để serve (không thêm dep Nest).
- Output ghi vào `uploads/hls-local-test/` (đã có dir `uploads/`, thêm vào `.gitignore` nếu cần).

## TDD (tests-first)
- Viết `scripts/hls/verify-output.mjs` (chạy bằng `node`, đóng vai test/acceptance) **trước**, assert đỏ khi chưa có output:
  - tồn tại `index.m3u8`, ≥1 `seg_*.ts`, `enc.key` đúng 16 byte.
  - `m3u8` chứa `#EXTM3U`, `#EXT-X-VERSION`, `#EXT-X-TARGETDURATION`, `#EXT-X-KEY:METHOD=AES-128`, `#EXT-X-ENDLIST`.
  - `ffprobe -show_streams` → `codec_name=aac`, `profile` LC.
- Chạy `transcode-local.mjs` → `verify-output.mjs` chuyển xanh.

## Related Code Files
- Create: `scripts/hls/transcode-local.mjs`, `scripts/hls/verify-output.mjs`, `scripts/hls/test-player.html`
- Modify: `.gitignore` (ignore `uploads/hls-local-test/`)

## Implementation Steps
1. Viết `verify-output.mjs` với các assertion ở trên (đỏ).
2. Viết `transcode-local.mjs` (keyinfo + ffmpeg + ffprobe summary).
3. Chạy với mp3 mẫu; sửa tới khi `verify-output.mjs` xanh.
4. Mở `test-player.html` qua http server; xác nhận phát + seek trên hls.js; thử ffplay/VLC.

## Success Criteria
- [ ] `verify-output.mjs` xanh (tag + codec + key + segments).
- [ ] hls.js phát mượt + seek OK; ffplay/VLC phát được.
- [ ] Lệnh ffmpeg + cấu trúc keyinfo được chốt làm contract cho Phase 3.

## Risk Assessment
- ffmpeg build thiếu encoder `aac` → dùng `aac` native (mặc định có); nếu thiếu, fallback `-c:a libfdk_aac` (hiếm). Ghi rõ trong script.
- Đường dẫn mp3 có khoảng trắng/ký tự đặc biệt → quote/pass arg dạng list (không nội suy shell).
