import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { HLS_TRANSCODE_QUEUE, HlsTranscodeJob } from './hls.constants';
import { HlsKeyService } from './hls-key.service';
import { HlsTranscodeService, TranscodeResult } from './hls-transcode.service';
import { HlsR2Service } from './hls-r2.service';

/**
 * Consumes HLS transcode jobs. Registered ONLY in the worker role (see
 * HlsModule) so api/scheduler never start a competing consumer.
 *
 * Crash-safety (red-team C6): the playlist is uploaded only after all segments,
 * and `status=ready` is set only after the playlist lands. Any failure marks
 * the asset `failed` and rethrows so BullMQ can retry — a half-written version
 * never becomes `ready`.
 */
@Processor(HLS_TRANSCODE_QUEUE)
export class HlsProcessor extends WorkerHost {
  private readonly logger = new Logger(HlsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keyService: HlsKeyService,
    private readonly transcoder: HlsTranscodeService,
    private readonly r2: HlsR2Service,
  ) {
    super();
  }

  async process(job: Job<HlsTranscodeJob>): Promise<void> {
    const { assetType, assetId, sourceUrl, hlsAssetId } = job.data;

    const asset = await this.prisma.hlsAsset.findUnique({
      where: { id: hlsAssetId },
    });
    if (!asset) {
      // Asset deleted between enqueue and processing — nothing to do.
      this.logger.warn(
        `HlsAsset ${hlsAssetId} not found; dropping job ${job.id}`,
      );
      return;
    }

    await this.prisma.hlsAsset.update({
      where: { id: hlsAssetId },
      data: { status: 'processing' },
    });

    const contentKey = this.keyService.unwrapKey(
      Buffer.from(asset.encKey),
      assetType,
      assetId,
    );
    const runId = randomUUID();
    let result: TranscodeResult | undefined;
    try {
      result = await this.transcoder.transcode({
        assetType,
        assetId,
        sourceUrl,
        contentKey,
        iv: asset.keyIv,
      });

      const { playlistUrl } = await this.r2.uploadPlaylist(
        result.workDir,
        result.segmentFiles,
        assetType,
        assetId,
        runId,
      );

      await this.prisma.hlsAsset.update({
        where: { id: hlsAssetId },
        data: {
          status: 'ready',
          playlistUrl,
          durationSec: result.durationSec,
          error: null,
        },
      });

      // Only after the new version is live: prune superseded versions (V3).
      await this.r2
        .cleanupOldVersions(assetType, assetId, runId)
        .catch((err) => {
          this.logger.warn(
            `cleanup of old HLS versions failed for ${assetType}:${assetId}: ${err}`,
          );
        });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.hlsAsset.update({
        where: { id: hlsAssetId },
        data: { status: 'failed', error: message },
      });
      throw err; // surface to BullMQ for retry/backoff
    } finally {
      if (result) await rm(result.workDir, { recursive: true, force: true });
    }
  }
}
