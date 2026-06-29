import { HlsQueueService } from '../hls-queue.service';
import type { Queue } from 'bullmq';
import type { PrismaService } from '@/prisma/prisma.service';
import type { HlsKeyService } from '../hls-key.service';

const stubKeyService = {
  generateContentKey: () => ({ key: Buffer.alloc(16, 1), iv: 'a'.repeat(32) }),
  wrapKey: () => Buffer.alloc(44, 2),
} as unknown as HlsKeyService;

describe('HlsQueueService.enqueueTranscode', () => {
  it('enqueues a transcode job with a dedupe jobId and the payload', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'chapter:c1' });
    const svc = new HlsQueueService(
      { add } as unknown as Queue,
      {} as PrismaService,
      stubKeyService,
    );

    const payload = {
      assetType: 'chapter' as const,
      assetId: 'c1',
      sourceUrl: 'http://r2/audio/chapters/a.mp3',
      hlsAssetId: 'h1',
    };
    await svc.enqueueTranscode(payload);

    expect(add).toHaveBeenCalledTimes(1);
    const [, data, opts] = add.mock.calls[0];
    expect(data).toEqual(payload);
    // jobId dedupes repeated enqueues for the same asset (red-team idempotency).
    // Must NOT contain ':' — BullMQ rejects that in a custom jobId.
    expect(opts.jobId).toBe('chapter__c1');
    expect(opts.jobId).not.toContain(':');
  });

  it('derives distinct jobIds per assetType + assetId', async () => {
    const add = jest.fn().mockResolvedValue({});
    const svc = new HlsQueueService(
      { add } as unknown as Queue,
      {} as PrismaService,
      stubKeyService,
    );

    await svc.enqueueTranscode({
      assetType: 'variant',
      assetId: 'v9',
      sourceUrl: 'http://r2/x.mp3',
      hlsAssetId: 'h2',
    });
    expect(add.mock.calls[0][2].jobId).toBe('variant__v9');
  });
});

describe('HlsQueueService.registerAsset', () => {
  const makeSvc = (add = jest.fn().mockResolvedValue({})) => {
    const upsert = jest.fn().mockResolvedValue({ id: 'hls-1' });
    const prisma = { hlsAsset: { upsert } } as unknown as PrismaService;
    const svc = new HlsQueueService(
      { add } as unknown as Queue,
      prisma,
      stubKeyService,
    );
    return { svc, add, upsert };
  };

  it('is a no-op when sourceUrl is falsy', async () => {
    const { svc, add, upsert } = makeSvc();
    await svc.registerAsset('music', 'm1', undefined);
    await svc.registerAsset('music', 'm1', '');
    expect(upsert).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it('upserts a pending asset then enqueues the transcode', async () => {
    const { svc, add, upsert } = makeSvc();
    await svc.registerAsset('chapter', 'c1', 'http://r2/a.mp3');
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0];
    expect(arg.create.status).toBe('pending');
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][2].jobId).toBe('chapter__c1');
  });

  it('does not throw when enqueue fails (left pending for reconcile, H7)', async () => {
    const add = jest.fn().mockRejectedValue(new Error('redis down'));
    const { svc, upsert } = makeSvc(add);
    await expect(
      svc.registerAsset('chapter', 'c1', 'http://r2/a.mp3'),
    ).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledTimes(1); // row persisted despite enqueue failure
  });
});
