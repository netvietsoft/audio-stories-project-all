/**
 * Gán category cho các truyện ebook đã import (theo tác giả + từ khoá tiêu đề).
 * Tạo bộ category văn học phù hợp nếu chưa có. Idempotent.
 *
 * Chạy: cd be && npx ts-node -T prisma/seed-ebook-categories.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Các tác giả đã import từ E:\Ebook (để giới hạn phạm vi gán).
const EBOOK_AUTHORS = [
  'Nam Cao', 'Huy Cận', 'Phạm Xuân Ẩn', 'Đoàn Giỏi', 'Tú Mỡ',
  'Tố Hữu', 'Tản Đà', 'Xuân Thiều', 'Tú Xương', 'Phạm Hổ',
];

// Bộ category cần có (tiếng Việt).
const CATEGORIES = [
  { slug: 'truyen-ngan', name: 'Truyện ngắn' },
  { slug: 'tieu-thuyet', name: 'Tiểu thuyết' },
  { slug: 'tho', name: 'Thơ' },
  { slug: 'hoi-ky-tieu-su', name: 'Hồi ký - Tiểu sử' },
  { slug: 'tinh-bao-chien-tranh', name: 'Tình báo - Chiến tranh' },
  { slug: 'van-hoc-thieu-nhi', name: 'Văn học thiếu nhi' },
];

// Category mặc định theo tác giả.
const AUTHOR_CATEGORY: Record<string, string> = {
  'Nam Cao': 'truyen-ngan',
  'Huy Cận': 'tho',
  'Phạm Xuân Ẩn': 'tinh-bao-chien-tranh',
  'Đoàn Giỏi': 'van-hoc-thieu-nhi',
  'Tú Mỡ': 'tho',
  'Tố Hữu': 'tho',
  'Tản Đà': 'tho',
  'Xuân Thiều': 'tieu-thuyet',
  'Tú Xương': 'tho',
  'Phạm Hổ': 'van-hoc-thieu-nhi',
};

const noAccent = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

/** Override theo từ khoá tiêu đề. Trả slug category hoặc null. */
const titleOverride = (title: string): string | null => {
  const t = noAccent(title);
  if (t.includes('hoi ky') || t.includes('hoi uc')) return 'hoi-ky-tieu-su';
  if (/\btho\b/.test(t)) return 'tho';
  return null;
};

async function main() {
  const vi = (await prisma.language.findFirst({ where: { key: 'vi' } })) ??
    (await prisma.language.findFirst({ orderBy: { id: 'asc' } }));
  if (!vi) throw new Error('Không tìm thấy language.');
  const languageId = vi.id;

  // Upsert categories
  const catId: Record<string, number> = {};
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { slug_languageId: { slug: c.slug, languageId } },
      update: {},
      create: { slug: c.slug, name: c.name, languageId, description: c.name },
    });
    catId[c.slug] = cat.id;
  }
  console.log(`Categories sẵn sàng: ${Object.keys(catId).length}`);

  // Lấy truyện ebook
  const authors = await prisma.author.findMany({
    where: { name: { in: EBOOK_AUTHORS } },
    select: { id: true, name: true },
  });
  const authorById = new Map(authors.map((a) => [a.id, a.name]));

  const stories = await prisma.story.findMany({
    where: { authorId: { in: authors.map((a) => a.id) } },
    select: { id: true, title: true, authorId: true },
  });

  let assigned = 0;
  let already = 0;

  for (const s of stories) {
    const authorName = authorById.get(s.authorId) ?? '';
    const slug = titleOverride(s.title) ?? AUTHOR_CATEGORY[authorName] ?? 'truyen-ngan';
    const categoryId = catId[slug];

    const res = await prisma.storyCategory.upsert({
      where: { storyId_categoryId: { storyId: s.id, categoryId } },
      update: {},
      create: { storyId: s.id, categoryId },
    });
    // upsert không cho biết created hay không; kiểm tra thủ công
    if (res) {
      assigned += 1;
    }
    console.log(`  ${authorName} · ${s.title}  ->  ${slug}`);
  }

  console.log(`\nHoàn tất: gán ${assigned} truyện (đã bao gồm cả trùng, idempotent). already=${already}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Lỗi gán category:', err);
  await prisma.$disconnect();
  process.exit(1);
});
