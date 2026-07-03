---
phase: 4
title: "Key Endpoint & Entitlement"
status: done
effort: ""
---

# Phase 4: Key Endpoint & Entitlement

## Overview
Endpoint trả key AES-128 có entitlement check (tái dùng logic unlock/VIP/access sẵn có), và expose `hlsUrl` trong response entity (mask khi locked). Đây là cổng bảo vệ duy nhất của HLS.

## Requirements
- Functional: `GET /hls/:assetType/:assetId/key` → check quyền → trả 16 byte key thô (binary) với `Content-Type: application/octet-stream`. Không quyền → 403; asset chưa `ready` → 404.
- Non-functional: fail-closed (mặc định từ chối); không log key/secret; mirror semantics của `GET /chapters/:id/audio`.

- assetType hợp lệ: **`chapter | variant | music`** (không `ad` — red-team C1).

## Architecture
- `src/hls/hls.controller.ts` — `@Get('hls/:assetType/:assetId/key')`:
  - **Validate `assetType` theo enum** (red-team H6) — giá trị ngoài enum → 400, không cho path tuỳ ý điều khiển nhánh authz.
  - Optional JWT (lấy `userId` nếu có; free vẫn cho khách). Query `variantId?` cho chapter.
  - **Rate limit** (red-team H6): áp `@Throttle` chặt hơn mặc định — chống dùng endpoint làm key-oracle/enumeration `assetId`.
- **Entitlement READ-ONLY (red-team C2 — BLOCKER):** `getAudioUrl` (`chapters.service.ts:481-639`) có `setImmediate(...userChapterUnlock.upsert)` (dòng 577, 594) → **KHÔNG tái dùng trực tiếp** (sẽ ghi unlock/billing mỗi lần hls.js lấy key). Phải tạo **hàm kiểm tra thuần read-only mới** `checkAudioEntitlement(...)` (chỉ `findUnique`/`findFirst`, **không upsert, không setImmediate**), dùng cho key endpoint. Hàm side-effecting cũ giữ nguyên cho `/audio` proxy.
- `src/hls/hls-key.service.ts` (mở rộng) — `authorize(assetType, assetId, userId?, variantId?): Promise<boolean>` dispatch:
  - `chapter` → `checkAudioEntitlement` chapter-level: free → ok; VIP còn hạn; `unlocksAt` timed; `UserChapterUnlock`. **Authorize đúng asset đã lưu**, không suy từ path.
  - `variant` → **mỗi variant là `HlsAsset('variant', variantId)` riêng** (red-team C4). Authorize theo **chính variant đó**: `UserUnlockedVariant` của variant này / VIP / free. KHÔNG cho unlock 1 variant mở key variant khác hay cả chapter.
  - `music` → entitlement **thật của music** (red-team H3): music **không dùng `vipTier`**; dùng `MusicUnlock` + free/`unlockPrice` (xem `music-interaction.service.ts:233`, `music.service.ts`). KHÔNG copy logic VIP của chapter.
  - `serveKey(assetType, assetId)` → load `HlsAsset`, `unwrapKey(encKey, assetType, assetId)` (AAD binding). Chỉ unwrap trong RAM.
- **Tránh circular dep:** trích `checkAudioEntitlement` (chapter/variant) và music-entitlement thành **hàm thuần / provider chia sẻ** (chỉ nhận Prisma + ids). `MusicModule` hiện **không export gì** → phải export provider hoặc đặt hàm dùng chung ở `src/common`. Ưu tiên hàm thuần thay vì `forwardRef`.
- **Expose hlsUrl (red-team M1 — defense-in-depth, KHÔNG phải boundary):** segment + IV nằm ở R2 path tất định/public → masking `hlsUrl` **không phải** rào bảo mật; **key endpoint là cổng duy nhất**. Vẫn set `hlsUrl=null` khi locked cho nhất quán UX:
  - chapters/variants: theo cách `audioUrl` đang bị ẩn (`chapters.service.ts:46,83`).
  - **music: hiện `serializeMusic` trả `audioUrl` vô điều kiện (`music.service.ts:516-522`) — KHÔNG có sẵn masking** (red-team H3). <!-- Updated: Validation Session 1 - V2 --> **Quyết định V2 (validate): mask CẢ `audioUrl` lẫn `hlsUrl` của music khi viewer chưa có quyền** (sửa lỗ hổng music trả audioUrl khi chưa unlock). ⚠️ Đây là **thay đổi API**: FE đang đọc `audioUrl` music trả phí phải chuyển sang gọi proxy/HLS — ghi rõ trong changelog/handoff FE.
  - Lookup `HlsAsset` theo `(assetType, assetId)` chỉ trả `hlsUrl` khi `status=ready`.

## TDD (tests-first)
- e2e `test/hls-key.e2e-spec.ts` (đỏ trước, theo pattern `test/jest-e2e.json`):
  - free chapter → 200 + body 16 byte.
  - paid chapter chưa unlock → 403.
  - paid chapter đã `UserChapterUnlock` / VIP còn hạn → 200.
  - **per-variant (C4):** unlock variant A → key variant A = 200, key variant B (chưa unlock) = 403, key chapter-level = không bị mở lây.
  - **music (H3):** free music → 200; paid music chưa `MusicUnlock` → 403; đã unlock → 200; (music KHÔNG mở bằng VIP tier).
  - **music masking (V2):** `serializeMusic` của music trả phí chưa unlock → `audioUrl=null` VÀ `hlsUrl=null`; đã unlock/free → trả đủ. Regression test cho hành vi mới này.
  - **assetType lạ** (vd `ad`, `foo`) → 400 (H6).
  - asset chưa `ready` → 404.
  - **read-only (C2):** gọi key endpoint nhiều lần KHÔNG tạo/đổi bản ghi `UserChapterUnlock` (assert count không tăng).
- unit `src/hls/__tests__/hls-key.authorize.spec.ts`: ma trận entitlement (mock Prisma) cho `chapter|variant|music`.

## Related Code Files
- Create: `src/hls/hls.controller.ts`, `test/hls-key.e2e-spec.ts`, `src/hls/__tests__/hls-key.authorize.spec.ts`
- Modify: `src/hls/hls-key.service.ts`, `src/hls/hls.module.ts`, `src/chapters/chapters.service.ts` (thêm `checkAudioEntitlement` read-only mới — KHÔNG sửa `getAudioUrl`), `src/music/music.service.ts` + `music-interaction.service.ts` (export entitlement; thêm masking music), `src/music/music.module.ts` (export provider), response shapers chapters/variants/music
- Read trước: `src/chapters/chapters.service.ts:481-639`, `src/music/music-interaction.service.ts:233`, `src/music/music.service.ts:516-522`

## Implementation Steps
1. Viết e2e + unit authorize (đỏ), gồm test read-only + per-variant + music-no-VIP + assetType 400.
2. Tạo `checkAudioEntitlement` read-only (chapter/variant) — KHÔNG đụng `getAudioUrl` side-effecting; trích music entitlement thật.
3. Implement `authorize` (dispatch 3 assetType, authorize theo row đã lưu) + `serveKey` (unwrap AAD) + controller (validate enum + throttle).
4. Wire `hlsUrl` vào response shapers; thêm masking MỚI cho music.
5. Specs xanh; chạy lại e2e cũ (chapters/rbac/auth) đảm bảo không regress; assert key endpoint không ghi unlock.

## Success Criteria
- [ ] e2e key matrix xanh: free=200, paid chưa unlock=403, unlocked/VIP(chapter)=200, per-variant cô lập, music theo MusicUnlock (no VIP), assetType lạ=400, chưa ready=404.
- [ ] **Key endpoint read-only:** gọi nhiều lần không tạo/đổi `UserChapterUnlock` (C2).
- [ ] `hlsUrl` chỉ xuất hiện khi ready+entitled, `null` khi locked (gồm music — masking mới).
- [ ] **V2:** music trả phí chưa unlock → cả `audioUrl` lẫn `hlsUrl` = null; FE handoff ghi rõ breaking change.
- [ ] Test entitlement cũ (chapters/rbac/auth) không regress.
- [ ] Key không xuất hiện trong log; serveKey chỉ unwrap trong RAM.

## Risk Assessment
- Circular module dep → ưu tiên hàm entitlement thuần; `MusicModule` phải export provider (hiện export rỗng). Nếu phải `forwardRef`, giữ tối thiểu.
- Khách (no JWT) gọi key free phải chạy; paid cần JWT → 401/403 rõ ràng.
- masking `hlsUrl` là defense-in-depth; **bảo mật thực nằm ở key endpoint** — không nới lỏng authorize vì nghĩ masking đã đủ.
