import { HlsKeyService } from '../hls-key.service';
import type { AppConfigService } from '@/shared/config/app-config.service';

// Pure unit test: construct the service with a stub config so no env/DB is needed.
const VALID_MASTER_KEY = 'a'.repeat(64); // 32 bytes hex

const makeService = (masterKey: string = VALID_MASTER_KEY) =>
  new HlsKeyService({ hls: { masterKey } } as unknown as AppConfigService);

describe('HlsKeyService crypto', () => {
  it('generateContentKey returns a 16-byte key and 32-hex-char IV', () => {
    const svc = makeService();
    const { key, iv } = svc.generateContentKey();
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(16);
    expect(iv).toMatch(/^[0-9a-f]{32}$/);
  });

  it('wrapKey -> unwrapKey round-trips to the original key (same asset)', () => {
    const svc = makeService();
    const key = svc.generateContentKey().key;
    const blob = svc.wrapKey(key, 'chapter', 'asset-1');
    const out = svc.unwrapKey(blob, 'chapter', 'asset-1');
    expect(out.equals(key)).toBe(true);
  });

  it('produces a different blob each wrap (random IV) but unwraps correctly', () => {
    const svc = makeService();
    const key = svc.generateContentKey().key;
    const a = svc.wrapKey(key, 'music', 'm1');
    const b = svc.wrapKey(key, 'music', 'm1');
    expect(a.equals(b)).toBe(false);
    expect(svc.unwrapKey(a, 'music', 'm1').equals(key)).toBe(true);
    expect(svc.unwrapKey(b, 'music', 'm1').equals(key)).toBe(true);
  });

  it('throws when the ciphertext/tag is tampered (GCM auth fail)', () => {
    const svc = makeService();
    const key = svc.generateContentKey().key;
    const blob = svc.wrapKey(key, 'chapter', 'asset-1');
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 0xff; // flip a ciphertext byte
    expect(() => svc.unwrapKey(tampered, 'chapter', 'asset-1')).toThrow();
  });

  it('throws on AAD mismatch — blob wrapped for (chapter, idA) cannot unwrap as (chapter, idB)', () => {
    const svc = makeService();
    const key = svc.generateContentKey().key;
    const blob = svc.wrapKey(key, 'chapter', 'idA');
    expect(() => svc.unwrapKey(blob, 'chapter', 'idB')).toThrow();
  });

  it('throws on AAD mismatch across assetType (variant vs chapter, same id)', () => {
    const svc = makeService();
    const key = svc.generateContentKey().key;
    const blob = svc.wrapKey(key, 'variant', 'same-id');
    expect(() => svc.unwrapKey(blob, 'chapter', 'same-id')).toThrow();
  });

  it('constructor throws (fail-closed) when master key is not 64 hex chars', () => {
    expect(() => makeService('tooshort')).toThrow();
    expect(() => makeService('z'.repeat(64))).toThrow(); // non-hex
    expect(() => makeService('a'.repeat(63))).toThrow(); // wrong length
  });

  it('buildKeyInfo returns exactly 3 ordered lines (uri, keyFile, iv)', () => {
    const svc = makeService();
    const info = svc.buildKeyInfo(
      'https://api/x/key',
      '/tmp/enc.key',
      'deadbeef',
    );
    const lines = info.trimEnd().split('\n');
    expect(lines).toEqual(['https://api/x/key', '/tmp/enc.key', 'deadbeef']);
  });
});
