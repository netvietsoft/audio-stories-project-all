import { copyFile, readFile, readdir, rm } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HlsKeyService } from '../hls-key.service';
import { HlsTranscodeService } from '../hls-transcode.service';
import type { HlsR2Service } from '../hls-r2.service';
import type { AppConfigService } from '@/shared/config/app-config.service';

// Integration: real ffmpeg on the sample mp3, R2 download mocked to a local
// copy, no DB. Resolve the sample by directory scan to avoid Unicode (NFC/NFD)
// pitfalls in the diacritic-heavy filename.
const SAMPLE_DIR = resolve(process.cwd(), '../audio-mp3-files');
const sampleName = readdirSync(SAMPLE_DIR).find((f) =>
  f.toLowerCase().endsWith('.mp3'),
);
const SAMPLE_MP3 = sampleName ? join(SAMPLE_DIR, sampleName) : '';

const cfg = {
  publicApiUrl: 'https://api.example.com',
  hls: { masterKey: 'a'.repeat(64), audioBitrate: '128k', segmentSeconds: 10 },
} as unknown as AppConfigService;

const describeOrSkip = SAMPLE_MP3 ? describe : describe.skip;

describeOrSkip('HlsTranscodeService (integration, real ffmpeg)', () => {
  let workDir = '';

  afterEach(async () => {
    if (workDir) await rm(workDir, { recursive: true, force: true });
    workDir = '';
  });

  it('produces an encrypted AES-128 playlist + segments with a config-derived key URI', async () => {
    const keyService = new HlsKeyService(cfg);
    const r2 = {
      downloadToFile: jest.fn(async (_url: string, dest: string) => {
        await copyFile(SAMPLE_MP3, dest);
      }),
    } as unknown as HlsR2Service;
    const svc = new HlsTranscodeService(cfg, keyService, r2);

    const { key, iv } = keyService.generateContentKey();
    const result = await svc.transcode({
      assetType: 'chapter',
      assetId: 'test-asset',
      sourceUrl: 'http://r2/audio/chapters/sample.mp3',
      contentKey: key,
      iv,
    });
    workDir = result.workDir;

    // Segments + duration
    expect(result.segmentFiles.length).toBeGreaterThan(0);
    expect(result.durationSec).toBeGreaterThan(0);
    const files = await readdir(result.workDir);
    expect(files).toContain('index.m3u8');
    expect(files.filter((f) => /^seg_\d+\.ts$/.test(f)).length).toBe(
      result.segmentFiles.length,
    );
    // enc.key must NOT be among the files a caller uploads (segments + playlist only)
    expect(result.segmentFiles).not.toContain('enc.key');

    // Playlist contract (reuse Phase 1 assertions) + absolute key URI from config
    const m3u8 = await readFile(join(result.workDir, 'index.m3u8'), 'utf8');
    expect(m3u8).toContain('#EXTM3U');
    expect(m3u8).toContain('#EXT-X-VERSION');
    expect(m3u8).toContain('#EXT-X-TARGETDURATION');
    expect(m3u8).toMatch(/#EXT-X-KEY:METHOD=AES-128/);
    expect(m3u8).toContain('#EXT-X-ENDLIST');
    expect(m3u8).toContain(
      'URI="https://api.example.com/hls/chapter/test-asset/key"',
    );

    expect(r2.downloadToFile).toHaveBeenCalledTimes(1);
  }, 60_000);
});
