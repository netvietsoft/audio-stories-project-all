// Backfill HLS: enqueue transcode cho mọi chapter + variant CÓ audio mà CHƯA có HLS.
// Bỏ qua asset đã có HlsAsset ở trạng thái ready/processing/pending (tránh transcode lại).
// Worker (APP_ROLE=worker) phải đang chạy để xử lý hàng đợi.
//
// Usage:
//   dotenv -e .env -- ts-node -r tsconfig-paths/register scripts/hls/backfill.ts [limit]
//   limit = số job tối đa enqueue lần này (0 hoặc bỏ trống = tất cả).
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HlsQueueService } from '@/hls/hls-queue.service';
import type { HlsAssetTypeName } from '@/hls/hls-key.service';

async function main() {
  const limit = Number(process.argv[2] || 0);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const prisma = app.get(PrismaService);
    const queue = app.get(HlsQueueService);

    const existing = await prisma.hlsAsset.findMany({
      select: { assetType: true, assetId: true, status: true },
    });
    const skip = new Set(
      existing
        .filter((a) => ['ready', 'processing', 'pending'].includes(a.status))
        .map((a) => `${a.assetType}:${a.assetId}`),
    );

    const chapters = await prisma.chapter.findMany({
      where: { OR: [{ r2AudioUrl: { not: null } }, { audioUrl: { not: null } }] },
      select: { id: true, audioUrl: true, r2AudioUrl: true },
    });
    const variants = await prisma.chapterVariant.findMany({
      where: {
        deletedAt: null,
        OR: [{ r2AudioUrl: { not: null } }, { audioUrl: { not: null } }],
      },
      select: { id: true, audioUrl: true, r2AudioUrl: true },
    });

    type Job = { type: HlsAssetTypeName; id: string; src: string };
    const jobs: Job[] = [];
    for (const c of chapters) {
      const src = c.r2AudioUrl ?? c.audioUrl;
      if (src && !skip.has(`chapter:${c.id}`)) jobs.push({ type: 'chapter', id: c.id, src });
    }
    for (const v of variants) {
      const src = v.r2AudioUrl ?? v.audioUrl;
      if (src && !skip.has(`variant:${v.id}`)) jobs.push({ type: 'variant', id: v.id, src });
    }

    const todo = limit > 0 ? jobs.slice(0, limit) : jobs;
    console.log(
      `[backfill] đủ điều kiện: ${jobs.length} (chapter ${chapters.length} + variant ${variants.length}, đã bỏ ${skip.size} cái có HLS). Enqueue lần này: ${todo.length}${limit > 0 ? ` (giới hạn ${limit})` : ''}`,
    );

    let n = 0;
    for (const j of todo) {
      await queue.registerAsset(j.type, j.id, j.src);
      n++;
      if (n % 50 === 0) console.log(`[backfill] enqueued ${n}/${todo.length}`);
    }
    console.log(`[backfill] DONE — enqueued ${n} job. Worker sẽ transcode dần.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
