import { HlsReconcileService } from '../hls-reconcile.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { HlsQueueService } from '../hls-queue.service';

describe('HlsReconcileService.reconcilePending (H7)', () => {
  const makeSvc = (
    stale: { id: string; assetType: string; assetId: string }[],
    sources: Record<
      string,
      { audioUrl?: string | null; r2AudioUrl?: string | null } | null
    > = {},
  ) => {
    const prisma = {
      hlsAsset: { findMany: jest.fn().mockResolvedValue(stale) },
      chapter: {
        findUnique: jest.fn(
          async ({ where }: any) => sources[where.id] ?? null,
        ),
      },
      chapterVariant: {
        findFirst: jest.fn(async ({ where }: any) => sources[where.id] ?? null),
      },
      music: {
        findUnique: jest.fn(
          async ({ where }: any) => sources[where.id] ?? null,
        ),
      },
    } as unknown as PrismaService;
    const enqueueTranscode = jest.fn().mockResolvedValue(undefined);
    const queue = { enqueueTranscode } as unknown as HlsQueueService;
    return { svc: new HlsReconcileService(prisma, queue), enqueueTranscode };
  };

  it('re-enqueues stale pending assets whose source still resolves', async () => {
    const { svc, enqueueTranscode } = makeSvc(
      [
        { id: 'h1', assetType: 'chapter', assetId: 'c1' },
        { id: 'h2', assetType: 'music', assetId: 'm1' },
      ],
      {
        c1: { r2AudioUrl: 'http://r2/c1.mp3' },
        m1: { audioUrl: 'http://r2/m1.mp3' },
      },
    );

    await svc.reconcilePending();

    expect(enqueueTranscode).toHaveBeenCalledTimes(2);
    expect(enqueueTranscode).toHaveBeenCalledWith(
      expect.objectContaining({
        assetType: 'chapter',
        assetId: 'c1',
        hlsAssetId: 'h1',
        sourceUrl: 'http://r2/c1.mp3',
      }),
    );
  });

  it('skips assets whose source no longer resolves', async () => {
    const { svc, enqueueTranscode } = makeSvc(
      [{ id: 'h1', assetType: 'chapter', assetId: 'gone' }],
      {},
    );
    await svc.reconcilePending();
    expect(enqueueTranscode).not.toHaveBeenCalled();
  });

  it('does nothing when there are no stale pending assets', async () => {
    const { svc, enqueueTranscode } = makeSvc([]);
    await svc.reconcilePending();
    expect(enqueueTranscode).not.toHaveBeenCalled();
  });
});
