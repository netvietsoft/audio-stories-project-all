import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { HlsKeyService, HlsAssetTypeName } from './hls-key.service';
import {
  HLS_TRANSCODE_QUEUE,
  HlsTranscodeJob,
  hlsJobId,
} from './hls.constants';

/**
 * Producer for HLS transcode jobs. Provided in every role (api/worker) — only
 * the {@link HlsProcessor} consumer is worker-only.
 */
@Injectable()
export class HlsQueueService {
  private readonly logger = new Logger(HlsQueueService.name);

  constructor(
    @InjectQueue(HLS_TRANSCODE_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly keyService: HlsKeyService,
  ) {}

  /**
   * Upsert a pending HlsAsset (fresh content key wrapped with AAD) and enqueue
   * its transcode. Called from entity create/update AFTER the DB commit. A
   * falsy sourceUrl is a no-op (nothing to transcode). Enqueue failures are
   * logged, not thrown — the reconcile cron re-enqueues orphaned pending rows
   * (red-team H7).
   */
  async registerAsset(
    assetType: HlsAssetTypeName,
    assetId: string,
    sourceUrl: string | null | undefined,
  ): Promise<void> {
    if (!sourceUrl) return;

    const { key, iv } = this.keyService.generateContentKey();
    const encKey = this.keyService.wrapKey(key, assetType, assetId);
    const asset = await this.prisma.hlsAsset.upsert({
      where: { assetType_assetId: { assetType, assetId } },
      create: { assetType, assetId, status: 'pending', encKey, keyIv: iv },
      update: { status: 'pending', encKey, keyIv: iv, error: null },
      select: { id: true },
    });

    try {
      await this.enqueueTranscode({
        assetType,
        assetId,
        sourceUrl,
        hlsAssetId: asset.id,
      });
    } catch (err) {
      // Do not roll back the entity; leave the row pending for the cron to retry.
      this.logger.error(
        `enqueue failed for ${assetType}:${assetId}; left pending for reconcile`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Enqueue a transcode job. The jobId dedupes repeated enqueues for the same
   * asset (e.g. rapid re-saves); re-transcode of changed audio still runs
   * because BullMQ replaces a completed job of the same id.
   */
  async enqueueTranscode(job: HlsTranscodeJob): Promise<void> {
    const jobId = hlsJobId(job.assetType, job.assetId);
    await this.queue.add(HLS_TRANSCODE_QUEUE, job, {
      jobId,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    this.logger.log(`enqueued transcode job ${jobId}`);
  }
}
