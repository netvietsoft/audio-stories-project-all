---
phase: 2
title: "Schema & Key Crypto"
status: done
effort: ""
---

# Phase 2: Schema & Key Crypto

## Overview
Nền tảng dữ liệu + mật mã: bảng polymorphic `HlsAsset`, config/env mới, và `HlsKeyService` sinh/wrap key AES-128 at-rest. Không có endpoint/queue ở phase này.

## Requirements
- Functional: lưu trạng thái + metadata HLS per asset; sinh key 16 byte + IV; wrap key bằng master key (env) để không lưu secret thô; unwrap khi cần phục vụ key.
- Non-functional: fail-closed nếu thiếu `HLS_MASTER_KEY`; key trong DB ở dạng đã mã hoá.

## Architecture
- **Prisma** `prisma/schema.prisma` — model mới:
  ```
  enum HlsAssetType { chapter variant music }   // 'ad' loại bỏ — Advertisement không có audio (red-team C1)
  enum HlsStatus    { pending processing ready failed }
  model HlsAsset {
    id           String        @id @default(uuid()) @db.VarChar(36)
    assetType    HlsAssetType  @map("asset_type")
    assetId      String        @map("asset_id") @db.VarChar(36)
    status       HlsStatus     @default(pending)
    playlistUrl  String?       @map("playlist_url") @db.VarChar(500)
    encKey       Bytes         @map("enc_key")   // AES-256-GCM wrapped (iv+tag+ct)
    keyIv        String        @map("key_iv") @db.VarChar(32)  // HLS content IV (hex)
    durationSec  Int?          @map("duration_sec") @db.UnsignedInt
    error        String?       @db.Text
    createdAt    DateTime      @default(now()) @map("created_at")
    updatedAt    DateTime      @updatedAt @map("updated_at")
    @@unique([assetType, assetId])
    @@index([status])
    @@map("hls_assets")
  }
  ```
  → `prisma migrate dev` tạo migration; `prisma generate`.
- **Config** `src/shared/config/app-config.schema.ts` — thêm:
  - `HLS_MASTER_KEY` — **chốt 1 format: hex 64 ký tự = 32 byte** (red-team H5). Validate regex `^[0-9a-fA-F]{64}$`; sai/thiếu → schema throw lúc boot (fail-closed).
  - `PUBLIC_API_URL` (red-team C3) — origin công khai của API (vd `https://api.example.com`), **bắt buộc** vì worker không có request host để build key URI tuyệt đối. Validate URL.
  - `HLS_AUDIO_BITRATE` (default `128k`), `HLS_SEGMENT_SECONDS` (default `10`).
  - Expose qua `app-config.service.ts` (`cfg.hls.*`, `cfg.publicApiUrl`).
- **Crypto** `src/hls/hls-key.service.ts` (chỉ phần crypto ở phase này):
  - `generateContentKey(): { key: Buffer(16), iv: hex }`.
  - `wrapKey(key: Buffer, assetType, assetId): Buffer` — AES-256-GCM với master key, **AAD = `${assetType}:${assetId}`** (red-team H5: chống transplant blob key giữa các row), output `iv(12)+tag(16)+ct`.
  - `unwrapKey(blob: Buffer, assetType, assetId): Buffer` — set AAD tương ứng; AAD sai → GCM auth fail → throw.
  - `buildKeyInfo(keyUri, keyFilePath, ivHex): string` — nội dung file keyinfo cho ffmpeg (contract từ Phase 1).

## TDD (tests-first)
- `src/hls/__tests__/hls-key.service.spec.ts` (đỏ trước):
  - `wrapKey`→`unwrapKey` round-trip = key gốc (cùng assetType/assetId).
  - blob mỗi lần wrap khác nhau (iv ngẫu nhiên), nhưng unwrap đều đúng.
  - tamper ct/tag → `unwrapKey` throw (GCM auth fail).
  - **AAD mismatch:** wrap với `(chapter, idA)` rồi unwrap với `(chapter, idB)` → throw (red-team H5, chống transplant).
  - thiếu/không hợp lệ master key (regex hex64) → constructor throw (fail-closed).
  - `generateContentKey` → key 16 byte, iv 32 hex chars.
  - `buildKeyInfo` → đúng 3 dòng, đúng thứ tự.

## Related Code Files
- Create: `src/hls/hls-key.service.ts`, `src/hls/__tests__/hls-key.service.spec.ts`, `prisma/migrations/*`
- Modify: `prisma/schema.prisma`, `src/shared/config/app-config.schema.ts`, `src/shared/config/app-config.service.ts`, `.env.example`

## Implementation Steps
1. Viết spec crypto (đỏ).
2. Thêm config keys + service getters; cập nhật `.env.example`.
3. Implement `HlsKeyService` crypto methods → spec xanh.
4. Thêm model Prisma + chạy migrate dev + generate.

## Success Criteria
- [ ] Spec crypto xanh; tamper/missing-key/AAD-mismatch fail-closed.
- [ ] `prisma migrate` chạy sạch, `HlsAsset` (enum 3 giá trị) có trong client.
- [ ] Config `cfg.hls.{masterKey,bitrate,segmentSeconds}` + `cfg.publicApiUrl` truy cập được; thiếu master key/PUBLIC_API_URL → boot fail rõ ràng.

## Risk Assessment
- Master key format: **chốt hex 64** (32 byte); tài liệu hoá trong `.env.example`. Không hỗ trợ base64 để tránh nhầm độ dài.
- `Bytes` column trên MySQL → Prisma map `LONGBLOB`/`VARBINARY`; kiểm tra migration tạo đúng kiểu.
