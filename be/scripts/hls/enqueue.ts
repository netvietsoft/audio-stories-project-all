// One-off: enqueue an HLS transcode for an EXISTING asset (no create/update needed).
// Boots a standalone Nest context (producer only — HlsProcessor is worker-role only)
// and calls the real HlsQueueService.registerAsset so key-wrapping + HlsAsset upsert
// + BullMQ enqueue all run exactly as in production.
//
// Usage:
//   dotenv -e .env -- ts-node -r tsconfig-paths/register scripts/hls/enqueue.ts music <musicId>
//   (assetType: music | chapter | variant)
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HlsQueueService } from '@/hls/hls-queue.service';
import type { HlsAssetTypeName } from '@/hls/hls-key.service';

async function resolveSourceUrl(
  prisma: PrismaService,
  assetType: HlsAssetTypeName,
  id: string,
): Promise<string | null> {
  if (assetType === 'chapter') {
    const c = await prisma.chapter.findUnique({
      where: { id },
      select: { audioUrl: true, r2AudioUrl: true },
    });
    return c?.r2AudioUrl ?? c?.audioUrl ?? null;
  }
  if (assetType === 'variant') {
    const v = await prisma.chapterVariant.findFirst({
      where: { id, deletedAt: null },
      select: { audioUrl: true, r2AudioUrl: true },
    });
    return v?.r2AudioUrl ?? v?.audioUrl ?? null;
  }
  const m = await prisma.music.findUnique({
    where: { id },
    select: { audioUrl: true },
  });
  return m?.audioUrl ?? null;
}

async function main() {
  const assetType = (process.argv[2] as HlsAssetTypeName) ?? 'music';
  const id = process.argv[3];
  if (!id) {
    console.error('usage: enqueue.ts <music|chapter|variant> <assetId>');
    process.exit(2);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const prisma = app.get(PrismaService);
    const queue = app.get(HlsQueueService);
    const sourceUrl = await resolveSourceUrl(prisma, assetType, id);
    console.log(`source for ${assetType}:${id} ->`, sourceUrl);
    if (!sourceUrl) throw new Error('no source audio url for that asset');
    await queue.registerAsset(assetType, id, sourceUrl);
    console.log('registerAsset done — pending row upserted + job enqueued');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
