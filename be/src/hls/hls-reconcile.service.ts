import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { HlsQueueService } from './hls-queue.service';
import { HlsAssetTypeName } from './hls-key.service';

/** Re-enqueue threshold: a pending asset older than this is presumed orphaned. */
const STALE_PENDING_MS = 10 * 60 * 1000;

/**
 * Reconcile orphaned pending HlsAssets (red-team H7): enqueue is fire-and-forget
 * after the entity commit, so a Redis blip can leave a row stuck `pending`. This
 * cron re-enqueues stale pending rows. Only active in the scheduler role
 * (ScheduleModule is initialised there; the @Cron is inert elsewhere). The
 * dedupe jobId makes re-enqueue safe if a job is in fact still queued.
 */
@Injectable()
export class HlsReconcileService {
  private readonly logger = new Logger(HlsReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: HlsQueueService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcilePending(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_PENDING_MS);
    const stale = await this.prisma.hlsAsset.findMany({
      where: { status: 'pending', updatedAt: { lt: cutoff } },
      select: { id: true, assetType: true, assetId: true },
    });
    if (!stale.length) return;

    let requeued = 0;
    for (const asset of stale) {
      const sourceUrl = await this.resolveSourceUrl(
        asset.assetType,
        asset.assetId,
      );
      if (!sourceUrl) continue;
      await this.queue
        .enqueueTranscode({
          assetType: asset.assetType,
          assetId: asset.assetId,
          sourceUrl,
          hlsAssetId: asset.id,
        })
        .then(() => {
          requeued++;
        })
        .catch((err) =>
          this.logger.warn(
            `reconcile re-enqueue failed for ${asset.assetType}:${asset.assetId}: ${err}`,
          ),
        );
    }
    if (requeued)
      this.logger.log(`reconciled ${requeued} stale pending HLS asset(s)`);
  }

  /** Re-derive the current source URL for an asset (HlsAsset does not store it). */
  private async resolveSourceUrl(
    assetType: HlsAssetTypeName,
    assetId: string,
  ): Promise<string | null> {
    if (assetType === 'chapter') {
      const c = await this.prisma.chapter.findUnique({
        where: { id: assetId },
        select: { audioUrl: true, r2AudioUrl: true },
      });
      return c?.r2AudioUrl ?? c?.audioUrl ?? null;
    }
    if (assetType === 'variant') {
      const v = await this.prisma.chapterVariant.findFirst({
        where: { id: assetId, deletedAt: null },
        select: { audioUrl: true, r2AudioUrl: true },
      });
      return v?.r2AudioUrl ?? v?.audioUrl ?? null;
    }
    const m = await this.prisma.music.findUnique({
      where: { id: assetId },
      select: { audioUrl: true },
    });
    return m?.audioUrl ?? null;
  }
}
