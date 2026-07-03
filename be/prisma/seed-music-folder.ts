/**
 * Generic one-off: upload 1 thư mục nhạc lên Cloudflare R2 + tạo record Music.
 * Cấu hình qua env:
 *   MUSIC_DIR    (bắt buộc)  vd: "E:/Music/Che Linh - Hat cho nguoi tinh phu"
 *   MUSIC_PREFIX (bắt buộc)  vd: "audio/music/che-linh"
 *   MUSIC_ARTIST (tuỳ chọn)  nếu set -> dùng làm artist cho tất cả, và tự bỏ
 *                            tiền tố "X - " khỏi tên file để lấy title
 *   MUSIC_TAGS   (tuỳ chọn)  danh sách phân tách bằng dấu phẩy
 *
 * Chạy: cd be && MUSIC_DIR="..." MUSIC_PREFIX="..." MUSIC_ARTIST="..." MUSIC_TAGS="..." npx ts-node -T prisma/seed-music-folder.ts
 * Idempotent theo slug.
 */
import 'dotenv/config';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MusicContentType, PrismaClient } from '@prisma/client';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const SOURCE_DIR = process.env.MUSIC_DIR;
const R2_PREFIX = (process.env.MUSIC_PREFIX || '').replace(/\/$/, '');
const FIXED_ARTIST = process.env.MUSIC_ARTIST?.trim() || '';
const TAGS = (process.env.MUSIC_TAGS || 'music').split(',').map((t) => t.trim()).filter(Boolean);
const DEFAULT_ARTIST = FIXED_ARTIST || 'Demo';

if (!SOURCE_DIR || !R2_PREFIX) {
  throw new Error('Cần đặt MUSIC_DIR và MUSIC_PREFIX');
}

const prisma = new PrismaClient();

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_URL } = process.env;
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_URL) {
  throw new Error('Thiếu cấu hình R2 trong .env');
}
const publicBase = R2_URL.replace(/\/$/, '');

const s3 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const toSlug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const getUniqueSlug = (raw: string, used: Set<string>): string => {
  const base = toSlug(raw) || `music-${Date.now()}`;
  let index = 0;
  while (true) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    index += 1;
  }
};

const parseName = (fileName: string): { title: string; artist: string } => {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  if (FIXED_ARTIST) {
    // Định dạng "Artist - Title": bỏ tiền tố "... - " đầu tiên để lấy title.
    const stripped = base.replace(/^.*?\s+-\s+/, '').trim();
    return { title: stripped || base, artist: FIXED_ARTIST };
  }
  const paren = base.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (paren) return { title: paren[1].trim(), artist: paren[2].replace(/_/g, ', ').trim() };
  const dash = base.match(/^(.*?)\s+-\s+(.+)$/);
  if (dash) {
    return { title: dash[1].replace(/[_\s]+$/g, '').trim() || base, artist: dash[2].replace(/_/g, ', ').trim() || DEFAULT_ARTIST };
  }
  return { title: base.replace(/_/g, ' ').trim(), artist: DEFAULT_ARTIST };
};

const AUDIO_EXT = /\.(mp3|m4a|wav|flac|aac|ogg)$/i;
const CONTENT_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac', ogg: 'audio/ogg',
};

async function main() {
  const files = readdirSync(SOURCE_DIR!)
    .filter((f) => AUDIO_EXT.test(f) && statSync(join(SOURCE_DIR!, f)).isFile())
    .sort();
  console.log(`Tìm thấy ${files.length} file audio trong ${SOURCE_DIR}`);

  const existing = await prisma.music.findMany({ select: { slug: true } });
  const usedSlugs = new Set(existing.map((m) => m.slug));

  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const { title, artist } = parseName(file);
    const slug = toSlug(title);
    if (usedSlugs.has(slug)) {
      console.log(`  ⏭  Bỏ qua (đã có slug): ${title}`);
      skipped += 1;
      continue;
    }
    const uniqueSlug = getUniqueSlug(title, usedSlugs);

    const ext = (file.split('.').pop() || 'mp3').toLowerCase();
    const buffer = readFileSync(join(SOURCE_DIR!, file));
    const key = `${R2_PREFIX}/${uniqueSlug}.${ext}`;

    process.stdout.write(`  ⬆  ${file} (${(buffer.length / 1048576).toFixed(1)} MB) -> ${title} / ${artist} ... `);
    await s3.send(
      new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: buffer, ContentType: CONTENT_TYPES[ext] || 'audio/mpeg' }),
    );
    console.log('done');

    await prisma.music.create({
      data: {
        title,
        slug: uniqueSlug,
        artist,
        description: `${TAGS.includes('nhac-vang') ? 'Nhạc vàng' : 'Nhạc'} - ${artist}`,
        tags: TAGS,
        thumbnailUrl: `https://picsum.photos/seed/${uniqueSlug}/600/600`,
        audioUrl: `${publicBase}/${key}`,
        contentType: MusicContentType.single,
        playlistTrackIds: [],
        isPublic: true,
      },
    });
    created += 1;
  }

  console.log(`\nHoàn tất: tạo mới ${created}, bỏ qua ${skipped}. Bucket=${R2_BUCKET_NAME}, prefix=${R2_PREFIX}/`);
}

main()
  .catch((err) => {
    console.error('Lỗi seed music folder:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
