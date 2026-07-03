import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AppConfigService } from '@/shared/config/app-config.service';

/** Valid HLS asset kinds. 'ad' is intentionally absent — Advertisement has no
 * audio field (red-team C1). Kept as a const tuple for reuse by callers. */
export const HLS_ASSET_TYPES = ['chapter', 'variant', 'music'] as const;
export type HlsAssetTypeName = (typeof HLS_ASSET_TYPES)[number];

const MASTER_KEY_RE = /^[0-9a-fA-F]{64}$/; // 32 bytes hex
const WRAP_IV_BYTES = 12; // GCM nonce
const WRAP_TAG_BYTES = 16; // GCM auth tag

/**
 * AES-128 content-key generation + at-rest wrapping for HLS assets.
 *
 * Content keys (16 byte) are wrapped with AES-256-GCM under the master key
 * (env `HLS_MASTER_KEY`). The AAD is bound to `${assetType}:${assetId}` so a
 * wrapped blob cannot be transplanted onto another asset row (red-team H5).
 * Wrapped layout: iv(12) ++ tag(16) ++ ciphertext(16).
 */
@Injectable()
export class HlsKeyService {
  private readonly masterKey: Buffer;

  constructor(config: AppConfigService) {
    const hex = config.hls.masterKey;
    if (!MASTER_KEY_RE.test(hex)) {
      // Fail-closed: never run with a missing/malformed master key.
      throw new Error('HLS_MASTER_KEY must be 64 hex characters (32 bytes)');
    }
    this.masterKey = Buffer.from(hex, 'hex');
  }

  /** Fresh AES-128 content key (16 byte) + random HLS content IV (hex). */
  generateContentKey(): { key: Buffer; iv: string } {
    return { key: randomBytes(16), iv: randomBytes(16).toString('hex') };
  }

  private aad(assetType: HlsAssetTypeName, assetId: string): Buffer {
    return Buffer.from(`${assetType}:${assetId}`, 'utf8');
  }

  /** Wrap a content key for at-rest storage, bound to its asset via AAD. */
  wrapKey(key: Buffer, assetType: HlsAssetTypeName, assetId: string): Buffer {
    const iv = randomBytes(WRAP_IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    cipher.setAAD(this.aad(assetType, assetId));
    const ct = Buffer.concat([cipher.update(key), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]);
  }

  /** Reverse {@link wrapKey}. Throws on tamper or AAD/asset mismatch. */
  unwrapKey(
    blob: Buffer,
    assetType: HlsAssetTypeName,
    assetId: string,
  ): Buffer {
    const iv = blob.subarray(0, WRAP_IV_BYTES);
    const tag = blob.subarray(WRAP_IV_BYTES, WRAP_IV_BYTES + WRAP_TAG_BYTES);
    const ct = blob.subarray(WRAP_IV_BYTES + WRAP_TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAAD(this.aad(assetType, assetId));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  /** ffmpeg `-hls_key_info_file` contents (3 lines): key URI, key file path, IV hex. */
  buildKeyInfo(keyUri: string, keyFilePath: string, ivHex: string): string {
    return [keyUri, keyFilePath, ivHex].join('\n') + '\n';
  }
}
