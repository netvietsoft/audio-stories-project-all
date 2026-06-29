---
title: "HLS (m3u8) audio: AES-128 + BullMQ + R2"
description: ""
status: implemented
priority: P2
branch: "master"
tags: []
blockedBy: []
blocks: []
created: "2026-06-29T03:21:42.843Z"
createdBy: "ck:plan"
source: skill
---

# HLS (m3u8) audio: AES-128 + BullMQ + R2

## Overview

Triển khai HLS (m3u8) cho audio các entity có audio thật: `Chapter`, `ChapterVariant`, `Music` (single-track). Mã hoá **AES-128** với key endpoint có auth, transcode **async qua BullMQ** (role `worker`), output lên **Cloudflare R2**. Giữ song song mp3 gốc (backward-compat). Format: **single-rendition AAC-LC / MPEG-TS**, segment ~10s, VOD. Chỉ transcode **data mới** (enqueue khi tạo/sửa entity). Test "chuẩn" trên local trước (Phase 1).

> **Scope correction (red-team):** `Advertisement` **không có field audio** (chỉ image/iframe/youtube) → **loại khỏi scope**. `Music` dạng `playlist` (đa-track-by-reference) → loại; chỉ `Music` single-track. Vậy assetType = `chapter | variant | music`.

**Insight kiến trúc:** AES-128 cho phép segment `.ts` để public trên R2/CDN vẫn an toàn (vô dụng nếu thiếu key). Chỉ cần gate 1 key endpoint bằng entitlement sẵn có. Mirror pattern hiện hữu `GET /chapters/:id/audio` (entitlement check → redirect).

**Mode:** `--tdd` (mỗi phase: viết test trước, đỏ → xanh). Nhạy cảm vì đụng logic unlock/VIP/billing.

**Nguồn:** brainstorm report `plans/reports/hls-audio-aes128-bullmq-r2-260629-1010-brainstorm-report.md`.

## Acceptance criteria (toàn plan)
- `ffprobe` xác nhận audio codec = AAC-LC.
- Playlist hợp lệ: `#EXTM3U`, `#EXT-X-VERSION`, `#EXT-X-TARGETDURATION`, `#EXT-X-KEY:METHOD=AES-128,URI=...,IV=0x...`, `#EXT-X-ENDLIST`.
- Phát mượt + seek trên hls.js + ffplay/VLC.
- Key endpoint: free → 200; paid chưa unlock → 403; đã unlock/VIP/admin → 200.
- Entity create với audio → job `pending`→`ready` → response trả `hlsUrl`.
- Thiếu `HLS_MASTER_KEY` → app fail-closed (không boot/không transcode).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Local HLS Validation](./phase-01-local-hls-validation.md) | Done |
| 2 | [Schema & Key Crypto](./phase-02-schema-key-crypto.md) | Done (migration apply pending — local DB auth) |
| 3 | [Transcode Queue & Worker](./phase-03-transcode-queue-worker.md) | Done (live worker-consume pending DB) |
| 4 | [Key Endpoint & Entitlement](./phase-04-key-endpoint-entitlement.md) | Done (e2e + chapter/variant hlsUrl deferred) |
| 5 | [Enqueue Hooks](./phase-05-enqueue-hooks.md) | Done |

## Implementation Status (2026-06-29)

Implemented via `/ck:cook`, TDD throughout. **98 unit tests pass** (incl. 42 HLS;
`bootstrap.spec.ts` boots api/worker/scheduler with the new modules), build +
typecheck + lint(0 errors) green. Code review: **all 8 acceptance criteria pass,
no Critical/High** (report in `reports/`).

**Blocked on environment (your action):** the `hls_assets` migration is written
(`prisma/migrations/20260629000000_add_hls_assets/`) but not applied locally —
MySQL `root@localhost` uses `auth_socket` (password denied). DB-backed checks
gated on this: live worker-consume (C5 acceptance), the key-endpoint e2e
(`test/hls-key.e2e-spec.ts`, not yet written), re-transcode cleanup (V3 live).

**Deferred (decisions, not defects):**
- chapter/variant `hlsUrl` response exposure — they use a 302-proxy model;
  where to surface `hlsUrl` is a product/UX decision (key endpoint protects them
  regardless).
- V2 music masking is a **breaking API change** — FE handoff in
  `reports/fe-handoff-music-audiourl-masking-breaking-change.md`.

**Accepted review findings:** playlist child-track `audioUrl` unmasked (out of
single-track scope), `.env.example` placeholder master key (matches repo's weak
dev-default convention), N+1 entitlement checks in music masking (small pages).

## Dependencies

- **Cross-plan:** none (scan `plans/` — không có plan dở dang khác).
- **Tooling:** `ffmpeg`/`ffprobe` (local có; production cần thêm vào Dockerfile runtime — Phase 3). Dep mới: `bullmq` (Phase 3). Redis dùng lại `REDIS_URL` hiện có.
- **Phase order:** 1 (độc lập) → 2 → 3 → 4 → 5. Phase 2 cung cấp schema+crypto cho 3; Phase 3 cung cấp pipeline+queue cho 5; Phase 4 cung cấp key endpoint mà playlist (Phase 3) trỏ tới (URI key có thể stub ở P3, hoàn thiện ở P4).

## Risks
- Dockerfile runtime thiếu `ffmpeg` → prod fail (mitigate P3).
- `HLS_MASTER_KEY` bắt buộc, fail-closed nếu thiếu (Rule 6).
- Nhiều segment `.ts` nhỏ → nhiều PutObject R2 (chi phí). Chấp nhận với `hls_time=10`.
- Role split: producer mọi nơi, processor chỉ `APP_ROLE=worker`.
- `hlsUrl` phải mask khi locked (nhất quán dù key đã gate).

## Out of scope
ABR/multi-bitrate, fMP4/CMAF, backfill data cũ, key rotation, DRM, bỏ mp3 gốc, **Advertisement audio** (không tồn tại), **Music playlist đa-track**.

## Open questions (đã chốt sau red-team)
- ~~Env base cho key URI~~ → **chốt: thêm `PUBLIC_API_URL`** (env mới), worker build key URI tuyệt đối từ đó (worker không có request host).
- ~~Music playlist đa-track~~ → **chốt: chỉ music single-track**.
- Còn lại: R2 bucket public hay private (quyết cách tải nguồn — GetObject vs GET URL) — xác nhận đầu Phase 3 bằng cách đọc `R2_*` env thực tế.

## Red Team Review

### Session — 2026-06-29
**Findings:** 15 (15 accepted, 0 rejected)
**Severity breakdown:** 6 Critical, 7 High, 2 Medium
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer (code-reviewer x3). Reports: `reports/from-code-reviewer-to-planner-red-team-*-plan-review-report.md`.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| C1 | Advertisement không có audio → bỏ `ad` | Critical | Accept | plan, P2, P4, P5 |
| C2 | `getAudioUrl`/music access không pure (setImmediate upsert) → dùng check read-only mới | Critical | Accept | P4 |
| C3 | Thiếu env API base; worker không có request host → thêm `PUBLIC_API_URL` | Critical | Accept | P2, P3 |
| C4 | Key per-variant: serveKey bỏ qua variantId → bypass | Critical | Accept | P4 |
| C5 | Worker có thể không consume job → verify BullMQ load trong bootstrap worker | Critical | Accept | P3 |
| C6 | Upload segment dở + crash → playlist hỏng → upload playlist sau cùng, ready sau khi xong | Critical | Accept | P3 |
| H1 | Thiếu đường tải nguồn từ R2 (chưa có GetObject) | High | Accept | P3 |
| H2 | ffmpeg vào Dockerfile nhưng prod chạy deploy.sh+PM2 host | High | Accept | P3 |
| H3 | Music entitlement sai (MusicUnlock, không vipTier, source=audioUrl) | High | Accept | P4, P5 |
| H4 | BullMQ dùng chung Redis cache không isolation | High | Accept | P3 |
| H5 | Master key: pin format + bind GCM AAD theo (assetType,assetId) | High | Accept | P2 |
| H6 | Key endpoint IDOR/assetType-confusion + không rate limit | High | Accept | P4 |
| H7 | Enqueue fire-and-forget → pending mồ côi khi crash → reconcile | High | Accept | P5 |
| M2 | Music playlist đa-track → chỉ single-track | Medium | Accept | plan, P5 |
| M3 | Sample mp3 ở `../audio-mp3-files/` (có space) → sửa path + quote arg | Medium | Accept | P1 |

### Whole-Plan Consistency Sweep
Sau khi áp dụng: scope thống nhất (`chapter|variant|music` ở plan/P2/P4/P5); `PUBLIC_API_URL` xuất hiện ở P2 (config) + P3 (dùng); `ad` đã xoá khỏi enum P2, dispatch P4, hook P5; music = single-track + `audioUrl` (không `r2AudioUrl`) ở P4/P5. Không còn mâu thuẫn tồn đọng.

## Validation Log

### Session — 2026-06-29 (3 câu hỏi)
Verification pass: **skip** (đã có `## Red Team Review` với evidence; không còn tag `[UNVERIFIED]`).

| # | Quyết định | Áp dụng |
|---|---|---|
| V1 | **Nguồn mp3: chấp nhận status quo public.** AES chỉ bảo vệ segment HLS; mp3 gốc (`audioUrl`) vẫn reachable nếu đoán URL. Việc chuyển audio sang private bucket → **tách plan riêng**, ngoài scope. | plan (ghi nhận giới hạn bảo mật) |
| V2 | **Mask cả `audioUrl` của music khi locked** (không chỉ `hlsUrl`). Sửa lỗ hổng `serializeMusic` trả `audioUrl` vô điều kiện. ⚠️ Thay đổi API music hiện tại — FE đọc `audioUrl` music trả phí phải chuyển sang gọi proxy/HLS. | P4 |
| V3 | **Xóa prefix HLS cũ sau khi bản mới `ready`** (tránh phình storage R2). | P3 |

**Giới hạn bảo mật đã chấp nhận (V1):** tính năng HLS+AES KHÔNG bịt được việc lộ mp3 gốc public. Bảo vệ nội dung trả phí ở mức HLS là lớp bổ sung, không thay thế việc cần private bucket sau này.

### Whole-Plan Consistency Sweep (post-validation)
V2 mở rộng masking music sang `audioUrl` (P4) — nhất quán với mục tiêu bảo vệ; V3 thêm bước cleanup prefix cũ (P3). Không phát sinh mâu thuẫn mới. Plan sẵn sàng implement.
