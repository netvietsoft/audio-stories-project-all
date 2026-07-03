/**
 * One-off: nạp truyện PDF từ D:\Downloads\PDF TRUYEN vào Author + Story + Chapter.
 * - Trích text bằng pdftotext (-enc UTF-8).
 * - Tên file "_OceanofPDF.com_Title_-_Author.pdf" -> title / author (author = phần cuối sau " - ").
 * - Ngôn ngữ English; gán category 'romance'.
 * - Dedup theo slug (vd Restless Demons ×6 -> 1). Idempotent.
 *
 * Yêu cầu: pdftotext trên PATH.
 * Chạy: cd be && npx ts-node -T prisma/seed-pdf-stories.ts
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, StoryStatus } from '@prisma/client';

const SOURCE_DIR = 'D:/Downloads/PDF TRUYEN';
const CATEGORY_SLUG = 'romance';

const prisma = new PrismaClient();

const toSlug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const getUniqueSlug = (raw: string, used: Set<string>): string => {
  const base = toSlug(raw) || `story-${Date.now()}`;
  let i = 0;
  while (true) {
    const c = i === 0 ? base : `${base}-${i + 1}`;
    if (!used.has(c)) { used.add(c); return c; }
    i += 1;
  }
};

const capBytes = (s: string, maxBytes: number): string => {
  const buf = Buffer.from(s, 'utf8');
  return buf.length <= maxBytes ? s : buf.subarray(0, maxBytes).toString('utf8').replace(/�+$/, '');
};

/** "_OceanofPDF.com_Title_-_Author.pdf" -> { title, author } */
const parseName = (fileName: string): { title: string; author: string } => {
  let base = fileName.replace(/\.pdf$/i, '');
  base = base.replace(/^_?OceanofPDF\.com_/i, '');
  base = base.replace(/\s*\(\d+\)\s*$/, ''); // bỏ hậu tố " (1)" của bản trùng
  base = base.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = base.split(/\s+-\s+/);
  if (parts.length >= 2) {
    const author = parts[parts.length - 1].trim();
    const title = parts.slice(0, -1).join(' - ').trim();
    return { title: title || base, author: author || 'Unknown' };
  }
  return { title: base, author: 'Unknown' };
};

let counter = 0;
const extractPdf = (path: string): string => {
  const out = execFileSync('pdftotext', ['-enc', 'UTF-8', path, '-'], { maxBuffer: 256 * 1024 * 1024 });
  return out.toString('utf-8').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
};

async function main() {
  const en = (await prisma.language.findFirst({ where: { key: 'en' } })) ??
    (await prisma.language.findFirst({ orderBy: { id: 'asc' } }));
  if (!en) throw new Error('Không tìm thấy language.');
  const languageId = en.id;

  // Category romance (en)
  const category = await prisma.category.upsert({
    where: { slug_languageId: { slug: CATEGORY_SLUG, languageId } },
    update: {},
    create: { slug: CATEGORY_SLUG, name: 'Romance', languageId, description: 'Romance' },
  });

  const files = readdirSync(SOURCE_DIR)
    .filter((f) => /\.pdf$/i.test(f) && statSync(join(SOURCE_DIR, f)).isFile())
    .sort();
  console.log(`Tìm thấy ${files.length} PDF trong ${SOURCE_DIR}`);

  const existingStories = await prisma.story.findMany({ select: { slug: true } });
  const storySlugs = new Set(existingStories.map((s) => s.slug));
  const existingAuthors = await prisma.author.findMany({ select: { slug: true, id: true } });
  const authorBySlug = new Map(existingAuthors.map((a) => [a.slug, a.id]));

  let storiesCreated = 0, skipped = 0;

  for (const file of files) {
    const { title, author } = parseName(file);
    const preSlug = toSlug(title);
    if (storySlugs.has(preSlug)) { console.log(`  ⏭  Trùng, bỏ qua: ${title}`); skipped += 1; continue; }

    let content: string;
    try {
      content = extractPdf(join(SOURCE_DIR, file));
    } catch (e) {
      console.warn(`  ⚠  Lỗi trích ${file}: ${(e as Error).message}`); continue;
    }
    if (!content || content.length < 50) { console.warn(`  ⚠  Rỗng/hỏng, bỏ qua: ${file}`); continue; }

    // Author
    const authorSlug = toSlug(author);
    let authorId = authorBySlug.get(authorSlug);
    if (!authorId) {
      const a = await prisma.author.upsert({
        where: { slug: authorSlug },
        update: {},
        create: { name: author, slug: authorSlug, languageId },
      });
      authorId = a.id;
      authorBySlug.set(authorSlug, authorId);
    }

    const slug = getUniqueSlug(title, storySlugs);
    const description = capBytes(content.replace(/\s+/g, ' ').slice(0, 300).trim(), 60000);

    const story = await prisma.story.create({
      data: {
        title, slug, languageId, authorId,
        description,
        status: StoryStatus.completed,
        totalChapters: 1,
        publishedAt: new Date(),
        thumbnailUrl: `https://picsum.photos/seed/${slug}/400/600`,
      },
    });
    await prisma.chapter.create({
      data: { storyId: story.id, chapterNumber: 1, title, languageId, content },
    });
    await prisma.storyCategory.create({ data: { storyId: story.id, categoryId: category.id } });

    storiesCreated += 1;
    counter += 1;
    console.log(`  ✅ ${title} — ${author}  (${content.length.toLocaleString()} ký tự)`);
  }

  console.log(`\nHoàn tất: truyện mới ${storiesCreated}, bỏ qua ${skipped}. Category=${CATEGORY_SLUG}, lang=${en.key}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Lỗi seed PDF:', err);
  await prisma.$disconnect();
  process.exit(1);
});
