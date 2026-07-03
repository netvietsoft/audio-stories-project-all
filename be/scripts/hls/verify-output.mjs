#!/usr/bin/env node
// Acceptance check for local HLS AES-128 output (Phase 1 source-of-truth).
// Asserts the playlist/segment/key contract that Phase 3 must reproduce.
// Usage: node verify-output.mjs [outputDir]   (default: uploads/hls-local-test)
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const outDir = resolve(process.argv[2] ?? 'uploads/hls-local-test');

let failures = 0;
const check = (label, cond, detail = '') => {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

console.log(`Verifying HLS output in: ${outDir}`);

// --- Files present ---
const m3u8Path = join(outDir, 'index.m3u8');
const keyPath = join(outDir, 'enc.key');
check('index.m3u8 exists', existsSync(m3u8Path), m3u8Path);
check('enc.key exists', existsSync(keyPath), keyPath);

const segments = existsSync(outDir)
  ? readdirSync(outDir).filter((f) => /^seg_\d+\.ts$/.test(f))
  : [];
check('>=1 seg_*.ts segment', segments.length >= 1, `found ${segments.length}`);

// --- Key is exactly 16 bytes (AES-128) ---
if (existsSync(keyPath)) {
  const keySize = statSync(keyPath).size;
  check('enc.key is 16 bytes', keySize === 16, `got ${keySize}`);
}

// --- Playlist required tags ---
if (existsSync(m3u8Path)) {
  const m3u8 = readFileSync(m3u8Path, 'utf8');
  check('playlist has #EXTM3U', m3u8.includes('#EXTM3U'));
  check('playlist has #EXT-X-VERSION', m3u8.includes('#EXT-X-VERSION'));
  check('playlist has #EXT-X-TARGETDURATION', m3u8.includes('#EXT-X-TARGETDURATION'));
  check(
    'playlist has #EXT-X-KEY:METHOD=AES-128',
    /#EXT-X-KEY:METHOD=AES-128/.test(m3u8),
  );
  check('playlist key line has URI=', /#EXT-X-KEY:[^\n]*URI=/.test(m3u8));
  check('playlist has #EXT-X-ENDLIST (VOD)', m3u8.includes('#EXT-X-ENDLIST'));
}

// --- Codec is AAC-LC (probe playlist from outDir so relative enc.key URI resolves) ---
if (existsSync(m3u8Path) && existsSync(keyPath)) {
  try {
    const out = execFileSync(
      'ffprobe',
      [
        '-v', 'error',
        '-allowed_extensions', 'ALL',
        '-select_streams', 'a:0',
        '-show_entries', 'stream=codec_name,profile',
        '-of', 'default=noprint_wrappers=1',
        'index.m3u8',
      ],
      { cwd: outDir, encoding: 'utf8' },
    );
    check('audio codec_name=aac', /codec_name=aac\b/.test(out), out.trim());
    check('audio profile=LC', /profile=LC/.test(out), out.trim());
  } catch (err) {
    check('ffprobe decodes playlist', false, err.stderr?.toString() ?? err.message);
  }
}

if (failures > 0) {
  console.error(`\n✗ ${failures} check(s) failed`);
  process.exit(1);
}
console.log('\n✓ All HLS output checks passed');
