/**
 * Backfill audioDuration cho các bài Music đang null (seed bỏ trống).
 * Tải file từ audioUrl (R2) rồi tính duration bằng mp3-duration.
 *
 * Chạy: cd be && npx ts-node -T prisma/backfill-music-duration.ts
 * (cần: npm install --no-save --legacy-peer-deps mp3-duration)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mp3Duration = require('mp3-duration');

const prisma = new PrismaClient();

const getDuration = (buf: Buffer): Promise<number> =>
  new Promise((resolve) => {
    mp3Duration(buf, (err: Error | null, dur: number) => {
      resolve(err || !dur ? 0 : Math.round(dur));
    });
  });

async function main() {
  const tracks = await prisma.music.findMany({
    where: { audioDuration: null },
    select: { id: true, title: true, audioUrl: true },
  });
  console.log(`Cần backfill: ${tracks.length} bài`);

  let ok = 0;
  let fail = 0;

  for (const t of tracks) {
    if (!t.audioUrl || !/\.mp3(\?|$)/i.test(t.audioUrl)) {
      console.warn(`  ⚠ Bỏ qua (không phải mp3/audioUrl trống): ${t.title}`);
      fail += 1;
      continue;
    }
    try {
      const res = await fetch(t.audioUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const dur = await getDuration(buf);
      if (!dur) throw new Error('duration=0');
      await prisma.music.update({ where: { id: t.id }, data: { audioDuration: dur } });
      const mm = Math.floor(dur / 60);
      const ss = String(dur % 60).padStart(2, '0');
      console.log(`  ✅ ${t.title}: ${mm}:${ss} (${dur}s)`);
      ok += 1;
    } catch (e) {
      console.warn(`  ⚠ ${t.title}: ${(e as Error).message}`);
      fail += 1;
    }
  }

  console.log(`\nXong: cập nhật ${ok}, lỗi/bỏ qua ${fail}.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Lỗi backfill:', err);
  await prisma.$disconnect();
  process.exit(1);
});
