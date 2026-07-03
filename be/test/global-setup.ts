/**
 * global-setup.ts – Chạy 1 lần trước TOÀN BỘ test suite E2E.
 *
 * Nhiệm vụ:
 * 1. Nạp biến môi trường từ .env.test (DATABASE_URL → temp_test_audio)
 * 2. Tạo database temp_test_audio nếu chưa tồn tại
 * 3. Chạy Prisma migrate reset --force (wipe + re-apply migrations)
 * 4. Seed dữ liệu tối thiểu: roles, language, author, category, story, chapter, variants, users
 *
 * AN TOÀN: Chỉ thao tác với DB được chỉ định trong .env.test (temp_test_audio).
 * KHÔNG BAO GIỜ chạm vào netviet_audio (dev/prod DB).
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

// ─── 1. Load .env.test ──────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.test');
dotenv.config({ path: envPath, override: true });

// Xác nhận DB URL trỏ đúng test DB
const dbUrl = process.env.DATABASE_URL ?? '';
if (!dbUrl.includes('temp_test_audio')) {
  throw new Error(
    `[GlobalSetup] DATABASE_URL phải chứa "temp_test_audio".\n` +
      `Hiện tại: ${dbUrl}\n` +
      `Kiểm tra file be/.env.test`,
  );
}

// Xuất DATABASE_URL cho child processes (prisma CLI)
process.env.DATABASE_URL = dbUrl;

// ─── 2. Tạo database nếu chưa có ────────────────────────────────────────────
function ensureDatabase() {
  try {
    const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)/);
    if (!match) {
      console.warn('[GlobalSetup] Không parse được DATABASE_URL, bỏ qua bước tạo DB.');
      return;
    }
    const [, user, password, host, port, dbName] = match;
    const cleanPassword = password ? `-p${password}` : '';

    execSync(
      `mysql -u ${user} ${cleanPassword} -h ${host} -P ${port} ` +
        `-e "CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`,
      { stdio: 'pipe' },
    );
    console.log(`[GlobalSetup] ✅ Database "${dbName}" đã sẵn sàng.`);
  } catch (err: any) {
    console.warn(`[GlobalSetup] ⚠️  Không thể tạo DB tự động: ${err.message}`);
    console.warn('[GlobalSetup] Prisma migrate sẽ thử tạo DB...');
  }
}

// ─── 3. Prisma DB Push (Nhanh hơn migrate reset) ──────────────────────────────
function runMigrations() {
  const prismaPath = path.resolve(__dirname, '../node_modules/.bin/prisma');
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

  console.log('[GlobalSetup] 🔄 Đang chạy prisma db push --force-reset...');
  try {
    execSync(
      `${prismaPath} db push --schema="${schemaPath}" --force-reset --accept-data-loss`,
      {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'pipe',
      },
    );
    console.log('[GlobalSetup] ✅ Prisma db push thành công.');
  } catch (err: any) {
    console.error(`[GlobalSetup] ❌ Prisma db push lỗi: ${err.message}`);
    throw err;
  }
}

// ─── 4. Seed minimal test data ───────────────────────────────────────────────
async function seedTestData(prisma: PrismaClient) {
  console.log('[GlobalSetup] 🌱 Seeding test data...');

  // ── Language (bắt buộc cho Author, Category, Story, Chapter) ──────────────
  const language = await prisma.language.upsert({
    where: { key: 'vi' },
    update: {},
    create: {
      key: 'vi',
      name: 'Tiếng Việt',
      isActive: true,
      displayOrder: 0,
    },
  });

  // ── Roles ──────────────────────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { slug: 'admin' },
    update: {},
    create: { name: 'ADMIN', slug: 'admin', description: 'Administrator' },
  });

  const userRole = await prisma.role.upsert({
    where: { slug: 'user' },
    update: {},
    create: { name: 'USER', slug: 'user', description: 'Regular user' },
  });

  // ── Admin user ─────────────────────────────────────────────────────────────
  const adminPasswordHash = await argon2.hash('Admin@1234Test');
  const admin = await prisma.user.upsert({
    where: { email: 'e2e-admin@test.local' },
    update: {
      passwordHash: adminPasswordHash,
      emailVerifiedAt: new Date(),
      roleId: adminRole.id,
      pulseBalance: 10000,
    },
    create: {
      email: 'e2e-admin@test.local',
      displayName: 'E2E Admin',
      passwordHash: adminPasswordHash,
      emailVerifiedAt: new Date(),
      roleId: adminRole.id,
      pulseBalance: 10000,
    },
  });

  // ── Regular user (POOR: pulse = 0) ────────────────────────────────────────
  const userPasswordHash = await argon2.hash('User@1234Test');
  const regularUser = await prisma.user.upsert({
    where: { email: 'e2e-user@test.local' },
    update: {
      passwordHash: userPasswordHash,
      emailVerifiedAt: new Date(),
      roleId: userRole.id,
      pulseBalance: 0,
    },
    create: {
      email: 'e2e-user@test.local',
      displayName: 'E2E User',
      passwordHash: userPasswordHash,
      emailVerifiedAt: new Date(),
      roleId: userRole.id,
      pulseBalance: 0,
    },
  });

  // ── Rich user (đủ pulse để mua variant) ───────────────────────────────────
  const richUser = await prisma.user.upsert({
    where: { email: 'e2e-rich@test.local' },
    update: {
      passwordHash: userPasswordHash,
      emailVerifiedAt: new Date(),
      roleId: userRole.id,
      pulseBalance: 5000,
    },
    create: {
      email: 'e2e-rich@test.local',
      displayName: 'E2E Rich User',
      passwordHash: userPasswordHash,
      emailVerifiedAt: new Date(),
      roleId: userRole.id,
      pulseBalance: 5000,
    },
  });

  // ── VIP user (vipTier > 0, có pulse) ───────────────────────────────────
  const vipUser = await prisma.user.upsert({
    where: { email: 'e2e-vip@test.local' },
    update: {
      passwordHash: userPasswordHash,
      emailVerifiedAt: new Date(),
      roleId: userRole.id,
      pulseBalance: 5000,
      vipTier: 1,
      vipExpirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    create: {
      email: 'e2e-vip@test.local',
      displayName: 'E2E VIP User',
      passwordHash: userPasswordHash,
      emailVerifiedAt: new Date(),
      roleId: userRole.id,
      pulseBalance: 5000,
      vipTier: 1,
      vipExpirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // ── Author (cần languageId) ────────────────────────────────────────────────
  const author = await prisma.author.upsert({
    where: { slug: 'e2e-test-author' },
    update: {},
    create: {
      name: 'E2E Test Author',
      slug: 'e2e-test-author',
      languageId: language.id,
    },
  });

  // ── Story (cần languageId + authorId) ─────────────────────────────────────
  // Story.slug có unique constraint trên (slug, languageId)
  let story = await prisma.story.findFirst({
    where: { slug: 'e2e-test-story', languageId: language.id },
  });
  if (!story) {
    story = await prisma.story.create({
      data: {
        title: 'E2E Test Story',
        slug: 'e2e-test-story',
        authorId: author.id,
        languageId: language.id,
      },
    });
  }

  // ── Chapter (cần languageId + storyId, unique: storyId+chapterNumber) ─────
  let chapter = await prisma.chapter.findUnique({
    where: { storyId_chapterNumber: { storyId: story.id, chapterNumber: 1 } },
  });
  if (!chapter) {
    chapter = await prisma.chapter.create({
      data: {
        storyId: story.id,
        chapterNumber: 1,
        title: 'Chapter 1 - E2E Test',
        languageId: language.id,
        accessType: 'free',
      },
    });
  }

  // ── VIP Chapter (accessType = 'vip') ────────────────────────────────────────────
  let vipChapter = await prisma.chapter.findUnique({
    where: { storyId_chapterNumber: { storyId: story.id, chapterNumber: 2 } },
  });
  if (!vipChapter) {
    vipChapter = await prisma.chapter.create({
      data: {
        id: 'e2e-vip-chapter-id-000002',
        storyId: story.id,
        chapterNumber: 2,
        title: 'Chapter 2 - VIP E2E Test',
        languageId: language.id,
        accessType: 'vip',
        unlockPrice: 0,
        audioUrl: 'https://example.com/vip-chapter-audio.mp3',
        r2AudioUrl: 'https://r2.example.com/vip-chapter-audio.mp3',
      },
    });
  } else {
    await prisma.chapter.update({
      where: { id: vipChapter.id },
      data: {
        accessType: 'vip',
        audioUrl: 'https://example.com/vip-chapter-audio.mp3',
        r2AudioUrl: 'https://r2.example.com/vip-chapter-audio.mp3',
      },
    });
  }

  // ── TIMED Chapter (accessType = 'timed', unlocksAt đã qua) ──────────────────────
  let timedChapter = await prisma.chapter.findUnique({
    where: { storyId_chapterNumber: { storyId: story.id, chapterNumber: 3 } },
  });
  if (!timedChapter) {
    timedChapter = await prisma.chapter.create({
      data: {
        id: 'e2e-timed-chapter-id-000003',
        storyId: story.id,
        chapterNumber: 3,
        title: 'Chapter 3 - TIMED E2E Test (Past)',
        languageId: language.id,
        accessType: 'timed',
        unlockPrice: 0,
        unlocksAt: new Date(Date.now() - 1000), // Đã qua → miễn phí
        audioUrl: 'https://example.com/timed-chapter-audio.mp3',
        r2AudioUrl: 'https://r2.example.com/timed-chapter-audio.mp3',
      },
    });
  } else {
    await prisma.chapter.update({
      where: { id: timedChapter.id },
      data: {
        accessType: 'timed',
        unlocksAt: new Date(Date.now() - 1000),
        audioUrl: 'https://example.com/timed-chapter-audio.mp3',
        r2AudioUrl: 'https://r2.example.com/timed-chapter-audio.mp3',
      },
    });
  }

  // ── TIMED Chapter Future (accessType = 'timed', unlocksAt tương lai) ──────────────────────
  let timedChapterFuture = await prisma.chapter.findUnique({
    where: { storyId_chapterNumber: { storyId: story.id, chapterNumber: 4 } },
  });
  if (!timedChapterFuture) {
    timedChapterFuture = await prisma.chapter.create({
      data: {
        id: 'e2e-timed-chapter-future-id-000004',
        storyId: story.id,
        chapterNumber: 4,
        title: 'Chapter 4 - TIMED E2E Test (Future)',
        languageId: language.id,
        accessType: 'timed',
        unlockPrice: 0,
        unlocksAt: new Date(Date.now() + 1000000), // Tương lai → cần VIP
        audioUrl: 'https://example.com/timed-chapter-audio.mp3',
        r2AudioUrl: 'https://r2.example.com/timed-chapter-audio.mp3',
      },
    });
  } else {
    await prisma.chapter.update({
      where: { id: timedChapterFuture.id },
      data: {
        accessType: 'timed',
        unlocksAt: new Date(Date.now() + 1000000),
        audioUrl: 'https://example.com/timed-chapter-audio.mp3',
        r2AudioUrl: 'https://r2.example.com/timed-chapter-audio.mp3',
      },
    });
  }

  // ── FREE Variant (unlockPrice = 0) ─────────────────────────────────────────
  const freeVariant = await prisma.chapterVariant.upsert({
    where: { id: 'e2e-free-variant-id-0000' },
    update: {
      content: 'Free content here',
      audioUrl: 'https://example.com/free-audio.mp3',
      r2AudioUrl: 'https://r2.example.com/free-audio.mp3',
      unlockPrice: 0,
    },
    create: {
      id: 'e2e-free-variant-id-0000',
      chapterId: chapter.id,
      title: 'Free Variant',
      content: 'Free content here',
      audioUrl: 'https://example.com/free-audio.mp3',
      r2AudioUrl: 'https://r2.example.com/free-audio.mp3',
      unlockPrice: 0,
      orderIndex: 0,
    },
  });

  // ── PAID Variant (unlockPrice = 100 pulse) ─────────────────────────────────
  const paidVariant = await prisma.chapterVariant.upsert({
    where: { id: 'e2e-paid-variant-id-0001' },
    update: {
      content: 'Paid content here - should be redacted',
      audioUrl: 'https://example.com/paid-audio.mp3',
      r2AudioUrl: 'https://r2.example.com/paid-audio.mp3',
      unlockPrice: 100,
    },
    create: {
      id: 'e2e-paid-variant-id-0001',
      chapterId: chapter.id,
      title: 'Paid Variant',
      content: 'Paid content here - should be redacted',
      audioUrl: 'https://example.com/paid-audio.mp3',
      r2AudioUrl: 'https://r2.example.com/paid-audio.mp3',
      unlockPrice: 100,
      orderIndex: 1,
    },
  });

  // ── Log kết quả ───────────────────────────────────────────────────────────
  console.log('[GlobalSetup] ✅ Seed hoàn tất.');
  console.log(`[GlobalSetup]   Language: ${language.key} (id: ${language.id})`);
  console.log(`[GlobalSetup]   Admin: ${admin.email} (id: ${admin.id}, roleId: ${adminRole.id})`);
  console.log(`[GlobalSetup]   User:  ${regularUser.email} (id: ${regularUser.id}, roleId: ${userRole.id})`);
  console.log(`[GlobalSetup]   Rich:  ${richUser.email} (id: ${richUser.id})`);
  console.log(`[GlobalSetup]   VIP User: ${vipUser.email} (id: ${vipUser.id})`);
  console.log(`[GlobalSetup]   Story: ${story.slug} (id: ${story.id})`);
  console.log(`[GlobalSetup]   Free Chapter: ${chapter.id} (accessType: free)`);
  console.log(`[GlobalSetup]   VIP Chapter: ${vipChapter.id} (accessType: vip)`);
  console.log(`[GlobalSetup]   TIMED Chapter (Past): ${timedChapter.id} (accessType: timed)`);
  console.log(`[GlobalSetup]   TIMED Chapter (Future): ${timedChapterFuture.id} (accessType: timed)`);
  console.log(`[GlobalSetup]   Free Variant: ${freeVariant.id}`);
  console.log(`[GlobalSetup]   Paid Variant: ${paidVariant.id}`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────
export default async function globalSetup() {
  console.log('\n[GlobalSetup] 🚀 Khởi động E2E test environment...');
  console.log(`[GlobalSetup] DATABASE_URL: ${dbUrl}`);

  ensureDatabase();
  runMigrations();

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    await seedTestData(prisma);
  } finally {
    await prisma.$disconnect();
  }

  console.log('[GlobalSetup] 🎉 Môi trường test đã sẵn sàng!\n');
}
