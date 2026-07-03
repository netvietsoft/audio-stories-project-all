#!/usr/bin/env node
// Local HLS AES-128 transcode (Phase 1) — the source-of-truth ffmpeg pipeline
// that Phase 3's worker wraps. No external deps: Node built-ins + system ffmpeg.
//
// Usage:
//   node transcode-local.mjs "<input.mp3>" [outputDir] [--bitrate 128k] [--hls-time 10]
//
// Defaults: outputDir=uploads/hls-local-test, bitrate=128k, hls_time=10.
// The input path is passed to ffmpeg as an arg-list element (never interpolated
// into a shell string) so paths with spaces / '#' are safe (red-team M3).
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const positional = [];
  const opts = { bitrate: '128k', hlsTime: '10' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bitrate') opts.bitrate = argv[++i];
    else if (a === '--hls-time') opts.hlsTime = argv[++i];
    else positional.push(a);
  }
  opts.input = positional[0];
  opts.outDir = positional[1] ?? 'uploads/hls-local-test';
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.input) {
  console.error(
    'Usage: node transcode-local.mjs "<input.mp3>" [outputDir] [--bitrate 128k] [--hls-time 10]',
  );
  process.exit(2);
}

const input = resolve(opts.input);
const outDir = resolve(opts.outDir);

// Fresh output dir each run.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// 1. Content key (16 byte = AES-128) + random IV (hex).
const key = randomBytes(16);
const ivHex = randomBytes(16).toString('hex');
const keyFile = join(outDir, 'enc.key');
writeFileSync(keyFile, key);

// 2. keyinfo file (3 lines): key URI (as written into the playlist) /
//    path to key file on disk (for ffmpeg to read) / IV hex.
//    Local key URI is the relative 'enc.key' so the test player + ffprobe
//    resolve it from the playlist directory. Phase 3 swaps this for the
//    absolute PUBLIC_API_URL key endpoint.
const keyInfo = ['enc.key', keyFile, ivHex].join('\n') + '\n';
const keyInfoFile = join(outDir, 'keyinfo');
writeFileSync(keyInfoFile, keyInfo);

// 3. ffmpeg — AAC-LC / MPEG-TS / VOD, single rendition. Arg list (no shell).
const ffmpegArgs = [
  '-y',
  '-i', input,
  '-vn',
  '-c:a', 'aac',
  '-b:a', opts.bitrate,
  '-ac', '2',
  '-ar', '44100',
  '-hls_time', opts.hlsTime,
  '-hls_playlist_type', 'vod',
  '-hls_segment_type', 'mpegts',
  '-hls_key_info_file', keyInfoFile,
  '-hls_segment_filename', join(outDir, 'seg_%03d.ts'),
  join(outDir, 'index.m3u8'),
];

console.log(`Transcoding: ${input}`);
console.log(`Output dir : ${outDir}`);
console.log(`ffmpeg ${ffmpegArgs.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
execFileSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });

// 4. ffprobe summary — confirm AAC-LC and report the playlist tags.
const probe = execFileSync(
  'ffprobe',
  [
    '-v', 'error',
    '-allowed_extensions', 'ALL',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,profile,channels,sample_rate',
    '-of', 'default=noprint_wrappers=1',
    'index.m3u8',
  ],
  { cwd: outDir, encoding: 'utf8' },
);

const segCount = readdirSync(outDir).filter((f) => /^seg_\d+\.ts$/.test(f)).length;
console.log('\n--- ffprobe (audio stream) ---');
console.log(probe.trim());
console.log(`\nSegments written: ${segCount}`);
console.log(`Done. Verify with: node scripts/hls/verify-output.mjs "${outDir}"`);
