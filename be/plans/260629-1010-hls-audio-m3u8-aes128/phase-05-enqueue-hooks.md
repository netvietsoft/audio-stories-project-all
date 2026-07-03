---
phase: 5
title: "Enqueue Hooks"
status: done
effort: ""
---

# Phase 5: Enqueue Hooks

## Overview
Kết nối lifecycle: khi tạo/sửa entity có audio mới (**chapter, variant, music single-track** — KHÔNG ad), tạo/cập nhật `HlsAsset` (pending) và enqueue job transcode. Chỉ data mới (không backfill).

## Requirements
- Functional: tại điểm create + update có audio thay đổi → upsert `HlsAsset(assetType, assetId, status=pending)` + sinh content key/iv (`HlsKeyService.wrapKey` với AAD) + `enqueueTranscode`. Audio đổi → re-transcode (status về pending, prefix versioned mới).
- Non-functional: enqueue sau commit DB; idempotent qua jobId dedupe; **không để pending mồ côi** (red-team H7).

## Architecture
- Inject `HlsQueueService` + `HlsKeyService` vào: `ChaptersService`, `ChapterVariantsService`, `MusicService` (qua import `HlsModule`). **Bỏ `AdsService`** — `Advertisement` không có audio (red-team C1; `schema.prisma:296-324`, `ads.service.ts:202-261`).
- Helper dùng chung `HlsQueueService.registerAsset(assetType, assetId, sourceUrl)`: tạo content key (wrap AAD, lưu `HlsAsset` pending), rồi `enqueueTranscode`. Tránh lặp.
- Điểm gọi:
  - `ChaptersService.create` / `createStandalone` / `update` (khi set chapter-level audio).
  - `ChapterVariantsService.create/update`.
  - `MusicService.create/update` — **chỉ `contentType=single`** (red-team M2). Bỏ qua `playlist` (đa-track-by-reference, `music.service.ts:306-312`) — sẽ phình + sai entitlement.
- **Source URL (red-team H3):**
  - chapter/variant: `r2AudioUrl ?? audioUrl`.
  - music: **`audioUrl` only** — `Music` KHÔNG có `r2AudioUrl` (`schema.prisma` Music model). Lưu ý `MusicService.create(dto, files)` resolve `audioUrl` **giữa transaction** (`music.service.ts:282,303-317`) → enqueue phải lấy URL đã resolve, sau commit, không enqueue khi URL rỗng.
- **Chống pending mồ côi (red-team H7):** enqueue sau commit; nếu enqueue lỗi (Redis down) → KHÔNG rollback entity, nhưng log + để **cron reconcile** (`@nestjs/schedule`) quét `HlsAsset.status=pending` quá hạn re-enqueue. (Cron đơn giản, không cần outbox đầy đủ.)

## TDD (tests-first)
- integration/spec mỗi service (đỏ trước, mock `HlsQueueService`):
  - `chapters.service.spec`: create chapter có audio → `registerAsset('chapter', id, url)` gọi 1 lần.
  - variant create → `registerAsset('variant', variantId, url)`.
  - music `single` có audioUrl → gọi; music `playlist` → KHÔNG gọi (M2); music không audio → không gọi.
  - update đổi audio → enqueue lại; update không đụng audio → không enqueue.
  - **(bỏ ad — không còn hook).**
- spec reconcile cron: `HlsAsset.status=pending` quá hạn → re-enqueue (H7).
- e2e nhẹ (tùy chọn): tạo chapter qua API → `HlsAsset` pending tồn tại.

## Related Code Files
- Modify: `src/chapters/chapters.service.ts` + `chapters.module.ts`, `src/chapters/chapter-variants/chapter-variants.service.ts` + module, `src/music/music.service.ts` + `music.module.ts`
- Create: specs tương ứng `*.spec.ts`, cron reconcile (trong `src/hls/`)
- **KHÔNG động** `src/ads/*` (ad ngoài scope)

## Implementation Steps
1. Viết specs enqueue cho 3 service + spec reconcile (đỏ).
2. Thêm `registerAsset` helper vào `HlsQueueService`.
3. Import `HlsModule` vào 3 module; inject + gọi sau commit tại create/update (music: chỉ single-track, URL đã resolve).
4. Thêm cron reconcile pending quá hạn.
5. Specs xanh; chạy worker local → tạo entity thật → quan sát `pending`→`ready`→`hlsUrl`.

## Success Criteria
- [ ] Specs enqueue 3 service xanh; chỉ enqueue khi audio mới/đổi; music `playlist` không enqueue.
- [ ] Cron reconcile re-enqueue được pending mồ côi (H7).
- [ ] E2E: tạo entity có audio → `HlsAsset` pending → (worker) ready → response có `hlsUrl`.
- [ ] Không regress test create/update hiện có.

## Risk Assessment
- Enqueue sau commit; enqueue lỗi không rollback entity (log + cron reconcile vớt — H7).
- Music URL resolve giữa transaction → đảm bảo lấy URL cuối, sau commit, bỏ qua khi rỗng.
- Update nhiều lần → dedupe jobId; re-transcode dùng prefix mới (P3).
