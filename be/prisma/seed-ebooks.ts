/**
 * One-off: nạp ebook (.doc) từ E:\Ebook\<Tác giả> vào Author + Story + Chapter.
 * - Mỗi thư mục = 1 Author (tiếng Việt).
 * - File "+ <Tên tác giả>.doc" = tiểu sử -> Author.bio.
 * - Mỗi file .doc còn lại = 1 Story + 1 Chapter (content = toàn văn trích bằng antiword).
 * - Bỏ qua .docx (đều có bản .doc song sinh).
 *
 * Yêu cầu: antiword có trên PATH (mingw). Trích qua bản copy tên ASCII để tránh
 * lỗi mã đường dẫn tiếng Việt trên Windows.
 *
 * Chạy: cd be && npx ts-node -T prisma/seed-ebooks.ts
 * Idempotent: bỏ qua Story đã có (slug+language); Author upsert theo slug.
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, StoryStatus } from '@prisma/client';

const BASE_DIR = 'E:/Ebook';
const AUTHOR_FOLDERS = [
  'Nam Cao', 'Huy Cận', 'Phạm Xuân Ẩn', 'Đoàn Giỏi', 'Tú Mỡ',
  'Tố Hữu', 'Tản Đà', 'Xuân Thiều', 'Tú Xương', 'Phạm Hổ',
];
const TMP_DIR = join(process.cwd(), '.ebook-tmp');

const prisma = new PrismaClient();

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
  const base = toSlug(raw) || `story-${Date.now()}`;
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

let tmpCounter = 0;
/** antiword đọc bản copy tên ASCII -> UTF-8 text. */
const extractDoc = (srcPath: string): string => {
  const tmp = join(TMP_DIR, `doc-${tmpCounter++}.doc`);
  copyFileSync(srcPath, tmp);
  try {
    const out = execFileSync('antiword', ['-m', 'UTF-8.txt', tmp], {
      maxBuffer: 256 * 1024 * 1024,
    });
    return out.toString('utf-8').replace(/\r\n/g, '\n').replace(/\[pic\]/g, '').trim();
  } finally {
    try { rmSync(tmp); } catch { /* ignore */ }
  }
};

/** Cắt chuỗi theo số BYTE UTF-8 (cột Text = 65535 bytes), không vỡ ký tự. */
const capBytes = (s: string, maxBytes: number): string => {
  const buf = Buffer.from(s, 'utf8');
  if (buf.length <= maxBytes) return s;
  return buf.subarray(0, maxBytes).toString('utf8').replace(/�+$/, '');
};

const baseName = (f: string) => f.replace(/\.[^.]+$/, '').trim();
const stripPlus = (f: string) => baseName(f).replace(/^\+\s*/, '').trim();

async function resolveLanguageId(): Promise<number> {
  const vi = await prisma.language.findFirst({ where: { key: 'vi' } });
  if (vi) return vi.id;
  const any = await prisma.language.findFirst({ orderBy: { id: 'asc' } });
  if (any) {
    console.warn(`Không thấy language key='vi', dùng '${any.key}' (id=${any.id}).`);
    return any.id;
  }
  throw new Error("Bảng languages trống. Hãy seed language 'vi' trước.");
}

async function main() {
  mkdirSync(TMP_DIR, { recursive: true });
  const languageId = await resolveLanguageId();

  const existingAuthors = await prisma.author.findMany({ select: { slug: true } });
  const authorSlugs = new Set(existingAuthors.map((a) => a.slug));
  const existingStories = await prisma.story.findMany({ select: { slug: true } });
  const storySlugs = new Set(existingStories.map((s) => s.slug));

  let authorsCreated = 0;
  let storiesCreated = 0;
  let skipped = 0;

  for (const folder of AUTHOR_FOLDERS) {
    const dir = join(BASE_DIR, folder);
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => /\.doc$/i.test(f) && statSync(join(dir, f)).isFile());
    } catch {
      console.warn(`⚠  Bỏ qua (không đọc được thư mục): ${folder}`);
      continue;
    }
    if (files.length === 0) {
      console.log(`—  ${folder}: không có file .doc`);
      continue;
    }

    const authorName = folder.trim();
    const authorSlug = toSlug(authorName);

    // Tách file tiểu sử: bắt đầu "+" và trùng tên tác giả
    const bioFile = files.find((f) => f.trimStart().startsWith('+') && toSlug(stripPlus(f)) === authorSlug);
    const storyFiles = files.filter((f) => f !== bioFile);

    let bio: string | null = null;
    if (bioFile) {
      try {
        bio = capBytes(extractDoc(join(dir, bioFile)), 63000) || null;
      } catch (e) {
        console.warn(`  ⚠  Không trích được tiểu sử ${bioFile}: ${(e as Error).message}`);
      }
    }

    // Upsert Author
    const author = await prisma.author.upsert({
      where: { slug: authorSlug },
      update: bio ? { bio } : {},
      create: { name: authorName, slug: authorSlug, languageId, bio: bio ?? undefined },
    });
    if (!authorSlugs.has(authorSlug)) {
      authorsCreated += 1;
      authorSlugs.add(authorSlug);
    }
    console.log(`\n👤 ${authorName} (${storyFiles.length} tác phẩm${bioFile ? ', +tiểu sử' : ''})`);

    for (const file of storyFiles) {
      const title = stripPlus(file);
      const preSlug = toSlug(title);
      if (storySlugs.has(preSlug)) {
        console.log(`  ⏭  Bỏ qua (đã có): ${title}`);
        skipped += 1;
        continue;
      }

      let content: string;
      try {
        content = extractDoc(join(dir, file));
      } catch (e) {
        console.warn(`  ⚠  Lỗi trích ${file}: ${(e as Error).message}`);
        continue;
      }
      if (!content) {
        console.warn(`  ⚠  Rỗng, bỏ qua: ${file}`);
        continue;
      }

      const slug = getUniqueSlug(title, storySlugs);
      const description = content.replace(/\s+/g, ' ').slice(0, 300).trim();

      const story = await prisma.story.create({
        data: {
          title,
          slug,
          languageId,
          authorId: author.id,
          description,
          status: StoryStatus.completed,
          totalChapters: 1,
          publishedAt: new Date(),
          thumbnailUrl: `https://picsum.photos/seed/${slug}/400/600`,
        },
      });

      await prisma.chapter.create({
        data: {
          storyId: story.id,
          chapterNumber: 1,
          title,
          languageId,
          content,
        },
      });

      storiesCreated += 1;
      console.log(`  ✅ ${title}  (${content.length.toLocaleString()} ký tự)`);
    }
  }

  try { rmSync(TMP_DIR, { recursive: true, force: true }); } catch { /* ignore */ }

  console.log(`\nHoàn tất: tác giả mới ${authorsCreated}, truyện mới ${storiesCreated}, bỏ qua ${skipped}.`);
}

main()
  .catch((err) => {
    console.error('Lỗi seed ebooks:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
