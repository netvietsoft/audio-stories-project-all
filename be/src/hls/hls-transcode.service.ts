import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { AppConfigService } from '@/shared/config/app-config.service';
import { HlsKeyService, HlsAssetTypeName } from './hls-key.service';
import { HlsR2Service } from './hls-r2.service';

const execFileAsync = promisify(execFile);

export interface FfmpegArgsOptions {
  input: string;
  outDir: string;
  keyInfoFile: string;
  bitrate: string;
  segmentSeconds: number;
}

/**
 * Build the ffmpeg arg list for AES-128 / AAC-LC / MPEG-TS VOD output.
 * Pure + exported so it can be unit-tested. Mirrors the validated Phase 1
 * pipeline (scripts/hls/transcode-local.mjs). All values are discrete args —
 * never interpolated into a shell string (safe for spaced/`#` paths).
 */
export function buildFfmpegArgs(opts: FfmpegArgsOptions): string[] {
  return [
    '-y',
    '-i',
    opts.input,
    '-vn',
    '-c:a',
    'aac',
    '-b:a',
    opts.bitrate,
    '-ac',
    '2',
    '-ar',
    '44100',
    '-hls_time',
    String(opts.segmentSeconds),
    '-hls_playlist_type',
    'vod',
    '-hls_segment_type',
    'mpegts',
    '-hls_key_info_file',
    opts.keyInfoFile,
    '-hls_segment_filename',
    join(opts.outDir, 'seg_%03d.ts'),
    join(opts.outDir, 'index.m3u8'),
  ];
}

export interface TranscodeInput {
  assetType: HlsAssetTypeName;
  assetId: string;
  sourceUrl: string;
  /** Raw 16-byte AES-128 content key (unwrapped by the caller). */
  contentKey: Buffer;
  /** HLS content IV (hex). */
  iv: string;
}

export interface TranscodeResult {
  /** Temp work dir holding index.m3u8 + seg_*.ts (caller uploads then removes). */
  workDir: string;
  durationSec: number;
  segmentFiles: string[];
}

/** Output files a caller should upload (segments + playlist), key/source excluded. */
export const PLAYLIST_FILENAME = 'index.m3u8';

@Injectable()
export class HlsTranscodeService {
  private readonly logger = new Logger(HlsTranscodeService.name);

  constructor(
    private readonly cfg: AppConfigService,
    private readonly keyService: HlsKeyService,
    private readonly r2: HlsR2Service,
  ) {}

  /** Absolute key URI the playlist points at — built from PUBLIC_API_URL since
   * the worker has no request host (red-team C3). */
  buildKeyUri(assetType: HlsAssetTypeName, assetId: string): string {
    const base = this.cfg.publicApiUrl.replace(/\/$/, '');
    return `${base}/hls/${assetType}/${assetId}/key`;
  }

  /**
   * Download the source, transcode to AES-128 HLS in a temp work dir, probe
   * duration. Does NOT upload or clean up the output dir — the caller uploads
   * the segments/playlist then removes {@link TranscodeResult.workDir}.
   */
  async transcode(input: TranscodeInput): Promise<TranscodeResult> {
    const workDir = await mkdtemp(join(tmpdir(), 'hls-'));
    let cleanupOnError = true;
    try {
      const sourcePath = join(workDir, 'source');
      await this.r2.downloadToFile(input.sourceUrl, sourcePath);

      // Write the raw content key + keyinfo (key URI is absolute, from config).
      const keyFile = join(workDir, 'enc.key');
      await writeFile(keyFile, input.contentKey);
      const keyUri = this.buildKeyUri(input.assetType, input.assetId);
      const keyInfoFile = join(workDir, 'keyinfo');
      await writeFile(
        keyInfoFile,
        this.keyService.buildKeyInfo(keyUri, keyFile, input.iv),
      );

      const args = buildFfmpegArgs({
        input: sourcePath,
        outDir: workDir,
        keyInfoFile,
        bitrate: this.cfg.hls.audioBitrate,
        segmentSeconds: this.cfg.hls.segmentSeconds,
      });
      await execFileAsync(this.cfg.hls.ffmpegPath, args);

      // Probe the SOURCE (not the encrypted playlist) — the playlist's key URI
      // is the auth-gated API endpoint, which ffprobe cannot fetch offline.
      const durationSec = await this.probeDuration(sourcePath);
      const segmentFiles = (await readdir(workDir)).filter((f) =>
        /^seg_\d+\.ts$/.test(f),
      );
      if (segmentFiles.length === 0) {
        throw new Error('ffmpeg produced no segments');
      }

      this.logger.log(
        `transcoded ${input.assetType}:${input.assetId} -> ${segmentFiles.length} segments, ${durationSec}s`,
      );
      cleanupOnError = false;
      return { workDir, durationSec, segmentFiles };
    } finally {
      if (cleanupOnError) await rm(workDir, { recursive: true, force: true });
    }
  }

  private async probeDuration(sourcePath: string): Promise<number> {
    const { stdout } = await execFileAsync(this.cfg.hls.ffprobePath, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      sourcePath,
    ]);
    return Math.round(parseFloat(stdout.trim()) || 0);
  }
}
