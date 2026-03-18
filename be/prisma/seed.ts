import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const slugify = (input: string) =>
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  console.log('Seeding roles...');

  const userRole = await prisma.role.upsert({
    where: { slug: 'user' },
    update: { name: 'USER', description: 'Default user role' },
    create: {
      name: 'USER',
      slug: 'user',
      description: 'Default user role',
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { slug: 'admin' },
    update: { name: 'ADMIN', description: 'Administrator role' },
    create: {
      name: 'ADMIN',
      slug: 'admin',
      description: 'Administrator role',
    },
  });

  console.log('Seeding languages...');

  await prisma.language.upsert({
    where: { key: 'vi' },
    update: {
      name: 'Tiếng Việt',
      isActive: true,
      displayOrder: 0,
    },
    create: {
      key: 'vi',
      name: 'Tiếng Việt',
      isActive: true,
      displayOrder: 0,
    },
  });

  await prisma.language.upsert({
    where: { key: 'en' },
    update: {
      name: 'English',
      isActive: true,
      displayOrder: 1,
    },
    create: {
      key: 'en',
      name: 'English',
      isActive: true,
      displayOrder: 1,
    },
  });

  console.log('Seeding users...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@truyen-audio.app';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const commonPassword = await argon2.hash(adminPassword);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      roleId: adminRole.id,
      emailVerifiedAt: new Date(),
      allowEmailNoti: true,
      allowBellNoti: true,
    },
    create: {
      email: adminEmail,
      displayName: 'Admin',
      passwordHash: commonPassword,
      emailVerifiedAt: new Date(),
      roleId: adminRole.id,
      allowEmailNoti: true,
      allowBellNoti: true,
    },
  });

  const demoUsers = [
    {
      email: 'reader1@seed.local',
      displayName: 'Reader One',
      avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=ReaderOne',
      credits: 128500,
      vipTier: 5,
      totalUnlockedStories: 320,
      vipExpirationDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      allowEmailNoti: true,
      allowBellNoti: true,
    },
    {
      email: 'reader2@seed.local',
      displayName: 'Reader Two',
      avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=ReaderTwo',
      credits: 117400,
      vipTier: 4,
      totalUnlockedStories: 281,
      vipExpirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      allowEmailNoti: true,
      allowBellNoti: true,
    },
    {
      email: 'reader3@seed.local',
      displayName: 'Reader Three',
      avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=ReaderThree',
      credits: 109300,
      vipTier: 4,
      totalUnlockedStories: 260,
      vipExpirationDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
      allowEmailNoti: true,
      allowBellNoti: true,
    },
    {
      email: 'reader4@seed.local',
      displayName: 'Reader Four',
      avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=ReaderFour',
      credits: 98200,
      vipTier: 3,
      totalUnlockedStories: 241,
      vipExpirationDate: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000),
      allowEmailNoti: true,
      allowBellNoti: true,
    },
    {
      email: 'reader5@seed.local',
      displayName: 'Reader Five',
      avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=ReaderFive',
      credits: 93100,
      vipTier: 2,
      totalUnlockedStories: 214,
      vipExpirationDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
      allowEmailNoti: false,
      allowBellNoti: true,
    },
    {
      email: 'reader6@seed.local',
      displayName: 'Reader Six',
      avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=ReaderSix',
      credits: 88700,
      vipTier: 2,
      totalUnlockedStories: 190,
      vipExpirationDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
      allowEmailNoti: true,
      allowBellNoti: false,
    },
  ];

  const seededUsers = [] as Array<{ id: string; email: string; displayName: string }>;
  for (const item of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        displayName: item.displayName,
        avatarUrl: item.avatarUrl,
        credits: item.credits,
        vipTier: item.vipTier,
        totalUnlockedStories: item.totalUnlockedStories,
        vipExpirationDate: item.vipExpirationDate,
        emailVerifiedAt: new Date(),
        roleId: userRole.id,
        allowEmailNoti: item.allowEmailNoti,
        allowBellNoti: item.allowBellNoti,
      },
      create: {
        email: item.email,
        displayName: item.displayName,
        passwordHash: commonPassword,
        credits: item.credits,
        avatarUrl: item.avatarUrl,
        vipTier: item.vipTier,
        totalUnlockedStories: item.totalUnlockedStories,
        vipExpirationDate: item.vipExpirationDate,
        emailVerifiedAt: new Date(),
        roleId: userRole.id,
        allowEmailNoti: item.allowEmailNoti,
        allowBellNoti: item.allowBellNoti,
      },
    });

    seededUsers.push({ id: user.id, email: user.email, displayName: user.displayName });
  }

  console.log('Seeding categories...');

  const categoriesData = [
    { name: 'Tiên Hiệp', slug: 'tien-hiep', language: 'vi', description: 'Thế giới tu luyện huyền bí' },
    { name: 'Xianxia', slug: 'xianxia', language: 'en', description: 'Cultivation fantasy world' },
    { name: 'Kiếm Hiệp', slug: 'kiem-hiep', language: 'vi', description: 'Giang hồ ân oán tình thù' },
    { name: 'Wuxia', slug: 'wuxia', language: 'en', description: 'Martial arts world' },
    { name: 'Đô Thị', slug: 'do-thi', language: 'vi', description: 'Truyện hiện đại' },
    { name: 'Urban', slug: 'urban', language: 'en', description: 'Modern stories' },
    { name: 'Ngôn Tình', slug: 'ngon-tinh', language: 'vi', description: 'Tình cảm lãng mạn' },
    { name: 'Romance', slug: 'romance', language: 'en', description: 'Romantic stories' },
    { name: 'Huyền Huyễn', slug: 'huyen-huyen', language: 'vi', description: 'Phiêu lưu kỳ ảo' },
    { name: 'Fantasy', slug: 'fantasy', language: 'en', description: 'Fantasy adventure' },
  ];

  const categories = [] as any[];
  for (const cat of categoriesData) {
    const existing = await prisma.category.findFirst({
      where: { slug: cat.slug, language: cat.language },
    });
    
    if (existing) {
      const updated = await prisma.category.update({
        where: { id: existing.id },
        data: { name: cat.name, description: cat.description },
      });
      categories.push(updated);
    } else {
      const created = await prisma.category.create({ data: cat });
      categories.push(created);
    }
  }

  console.log('Seeding authors...');

  const authorNames = ['Thần Đồng', 'Thiên Tàm Thổ Đậu', 'Dương Gia Tam Thiếu', 'Mộng Nhập Thần Cơ', 'Ngã Cật Tây Hồng Thị'];

  const authors = [] as Awaited<ReturnType<typeof prisma.author.upsert>>[];
  for (const name of authorNames) {
    const author = await prisma.author.upsert({
      where: { slug: slugify(name) },
      update: {
        name,
        language: 'vi',
      },
      create: {
        name,
        slug: slugify(name),
        language: 'vi',
      },
    });
    authors.push(author);
  }

  console.log('Seeding stories and chapters...');

  const storySeed = [
    { vi: 'Phàm Nhân Tu Tiên', en: 'A Record of a Mortal Journey to Immortality' },
    { vi: 'Đấu Phá Thương Khung', en: 'Battle Through the Heavens' },
    { vi: 'Tiên Nghịch', en: 'Renegade Immortal' },
    { vi: 'Nhất Niệm Vĩnh Hằng', en: 'A Will Eternal' },
    { vi: 'Tinh Thần Biến', en: 'Stellar Transformations' },
    { vi: 'Truyện Tương Tác Demo', en: 'Interactive Story Demo', isInteractive: true },
  ];

  const stories = [] as Awaited<ReturnType<typeof prisma.story.upsert>>[];
  const firstChapterByStory = new Map<string, string>();

  const paragraphTemplates = [
    'Night covered the mountain and spirit energy was flowing quickly around the valley.',
    'He opened his eyes and felt his cultivation pulse move faster than before.',
    'A strange pressure arrived from afar and the whole canyon became silent.',
    'He held his sword and decided to move forward despite uncertain outcome.',
  ];

  for (let i = 0; i < storySeed.length; i += 1) {
    const storyData = storySeed[i]!;
    
    const titleVi = storyData.vi;
    const slugVi = slugify(titleVi);
    const descriptionVi = `${titleVi} - truyện audio tiếng Việt dùng để kiểm tra giao diện và chức năng cập nhật chương.`;
    
    const existingVi = await prisma.story.findFirst({
      where: { slug: slugVi, language: 'vi' },
    });

    const storyVi = existingVi
      ? await prisma.story.update({
          where: { id: existingVi.id },
          data: {
            title: titleVi,
            language: 'vi',
            authorId: authors[i % authors.length].id,
            status: i % 3 === 0 ? 'completed' : 'ongoing',
            thumbnailUrl: `https://picsum.photos/seed/story-vi-${i + 1}/600/900`,
            totalViews: BigInt(200000 + i * 45000),
            isFeatured: i < 3,
            isRecommended: i % 2 === 0,
            isInteractive: (storyData as any).isInteractive || false,
            featuredOrder: i < 3 ? i + 1 : null,
            description: descriptionVi,
          },
        })
      : await prisma.story.create({
          data: {
            title: titleVi,
            slug: slugVi,
            language: 'vi',
            authorId: authors[i % authors.length].id,
            status: i % 3 === 0 ? 'completed' : 'ongoing',
            thumbnailUrl: `https://picsum.photos/seed/story-vi-${i + 1}/600/900`,
            totalViews: BigInt(200000 + i * 45000),
            isFeatured: i < 3,
            isRecommended: i % 2 === 0,
            isInteractive: (storyData as any).isInteractive || false,
            featuredOrder: i < 3 ? i + 1 : null,
            description: descriptionVi,
          },
        });

    await prisma.storyCategory.deleteMany({ where: { storyId: storyVi.id } });
    const viCats = categories.filter(c => c.language === 'vi');
    await prisma.storyCategory.createMany({
      data: [
        { storyId: storyVi.id, categoryId: viCats[i % viCats.length].id },
        { storyId: storyVi.id, categoryId: viCats[(i + 1) % viCats.length].id },
      ],
      skipDuplicates: true,
    });

    stories.push(storyVi);

    const titleEn = storyData.en;
    const slugEn = slugify(titleEn);
    const descriptionEn = `${titleEn} - English audio story for interface and chapter update testing.`;
    
    const existingEn = await prisma.story.findFirst({
      where: { slug: slugEn, language: 'en' },
    });

    const storyEn = existingEn
      ? await prisma.story.update({
          where: { id: existingEn.id },
          data: {
            title: titleEn,
            language: 'en',
            authorId: authors[i % authors.length].id,
            status: i % 3 === 0 ? 'completed' : 'ongoing',
            thumbnailUrl: `https://picsum.photos/seed/story-en-${i + 1}/600/900`,
            totalViews: BigInt(180000 + i * 40000),
            isFeatured: i < 3,
            isRecommended: i % 2 === 1,
            isInteractive: (storyData as any).isInteractive || false,
            featuredOrder: i < 3 ? i + 6 : null,
            description: descriptionEn,
          },
        })
      : await prisma.story.create({
          data: {
            title: titleEn,
            slug: slugEn,
            language: 'en',
            authorId: authors[i % authors.length].id,
            status: i % 3 === 0 ? 'completed' : 'ongoing',
            thumbnailUrl: `https://picsum.photos/seed/story-en-${i + 1}/600/900`,
            totalViews: BigInt(180000 + i * 40000),
            isFeatured: i < 3,
            isRecommended: i % 2 === 1,
            isInteractive: (storyData as any).isInteractive || false,
            featuredOrder: i < 3 ? i + 6 : null,
            description: descriptionEn,
          },
        });

    await prisma.storyCategory.deleteMany({ where: { storyId: storyEn.id } });
    const enCats = categories.filter(c => c.language === 'en');
    await prisma.storyCategory.createMany({
      data: [
        { storyId: storyEn.id, categoryId: enCats[i % enCats.length].id },
        { storyId: storyEn.id, categoryId: enCats[(i + 1) % enCats.length].id },
      ],
      skipDuplicates: true,
    });

    stories.push(storyEn);

    const chapterTotal = 15;
    for (let chapterNumber = 1; chapterNumber <= chapterTotal; chapterNumber += 1) {
      const chapterSeed = i * 20 + chapterNumber;
      const paragraphCount = 3 + (chapterNumber % 2);
      const content = Array.from({ length: paragraphCount }, (_, idx) => {
        const template = paragraphTemplates[(chapterNumber + idx) % paragraphTemplates.length]!;
        return `[Đoạn ${idx + 1}] ${template}`;
      }).join('\n\n');

      const chapterTitle = `Chương ${chapterNumber}: Chuyển động linh lực`;
      const chapterDescription = `Giới thiệu chương ${chapterNumber} của ${titleVi}`;
      const chapterAudio = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(chapterSeed % 16) + 1}.mp3`;
      const chapterThumb = `https://picsum.photos/seed/chapter-vi-${i + 1}-${chapterNumber}/320/320`;

      const accessType = chapterNumber % 9 === 0 ? 'vip' : chapterNumber % 4 === 0 ? 'timed' : 'free';
      const unlocksAt = accessType === 'timed'
        ? new Date(Date.now() + ((chapterNumber % 5) + 1) * 24 * 60 * 60 * 1000)
        : null;

      const chapter = await prisma.chapter.upsert({
        where: {
          storyId_chapterNumber: {
            storyId: storyVi.id,
            chapterNumber,
          },
        },
        update: {
          title: chapterTitle,
          language: 'vi',
          description: chapterDescription,
          thumbnailUrl: chapterThumb,
          content,
          r2AudioUrl: chapterAudio,
          youtubeVideoId: chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
          isInteractive: (storyData as any).isInteractive && chapterNumber === 1 ? true : false,
        },
        create: {
          storyId: storyVi.id,
          chapterNumber,
          title: chapterTitle,
          language: 'vi',
          description: chapterDescription,
          thumbnailUrl: chapterThumb,
          content,
          r2AudioUrl: chapterAudio,
          youtubeVideoId: chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
          isInteractive: (storyData as any).isInteractive && chapterNumber === 1 ? true : false,
        },
      });

      if (chapterNumber === 1) {
        firstChapterByStory.set(storyVi.id, chapter.id);
      }
    }

    await prisma.story.update({
      where: { id: storyVi.id },
      data: { totalChapters: chapterTotal },
    });

    for (let chapterNumber = 1; chapterNumber <= chapterTotal; chapterNumber += 1) {
      const chapterSeed = i * 20 + chapterNumber + 100;
      const paragraphCount = 3 + (chapterNumber % 2);
      const content = Array.from({ length: paragraphCount }, (_, idx) => {
        const template = paragraphTemplates[(chapterNumber + idx) % paragraphTemplates.length]!;
        return `[Paragraph ${idx + 1}] ${template}`;
      }).join('\n\n');

      const chapterTitle = `Chapter ${chapterNumber}: Spirit Shift`;
      const chapterDescription = `Chapter ${chapterNumber} introduction of ${titleEn}`;
      const chapterAudio = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(chapterSeed % 16) + 1}.mp3`;
      const chapterThumb = `https://picsum.photos/seed/chapter-en-${i + 1}-${chapterNumber}/320/320`;

      const accessType = chapterNumber % 9 === 0 ? 'vip' : chapterNumber % 4 === 0 ? 'timed' : 'free';
      const unlocksAt = accessType === 'timed'
        ? new Date(Date.now() + ((chapterNumber % 5) + 1) * 24 * 60 * 60 * 1000)
        : null;

      const chapter = await prisma.chapter.upsert({
        where: {
          storyId_chapterNumber: {
            storyId: storyEn.id,
            chapterNumber,
          },
        },
        update: {
          title: chapterTitle,
          language: 'en',
          description: chapterDescription,
          thumbnailUrl: chapterThumb,
          content,
          r2AudioUrl: chapterAudio,
          youtubeVideoId: chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
          isInteractive: (storyData as any).isInteractive && chapterNumber === 1 ? true : false,
        },
        create: {
          storyId: storyEn.id,
          chapterNumber,
          title: chapterTitle,
          language: 'en',
          description: chapterDescription,
          thumbnailUrl: chapterThumb,
          content,
          r2AudioUrl: chapterAudio,
          youtubeVideoId: chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
          isInteractive: (storyData as any).isInteractive && chapterNumber === 1 ? true : false,
        },
      });

      if (chapterNumber === 1) {
        firstChapterByStory.set(storyEn.id, chapter.id);
      }
    }

    await prisma.story.update({
      where: { id: storyEn.id },
      data: { totalChapters: chapterTotal },
    });

    if ((storyData as any).isInteractive) {
      const firstChapterVi = await prisma.chapter.findFirst({
        where: { storyId: storyVi.id, chapterNumber: 1 },
      });

      if (firstChapterVi) {
        console.log(`Seeding variants for ${titleVi} Chapter 1...`);
        const variants = [
          { title: 'Path A: The Silent Approach', unlockPrice: 0, content: 'You choose to sneak in...' },
          { title: 'Path B: The Direct Confrontation', unlockPrice: 100, content: 'You charge forward!' },
          { title: 'Path C: The Secret Alliance', unlockPrice: 200, content: 'You talk to the guard...' },
        ];

        for (let j = 0; j < variants.length; j++) {
          await (prisma.chapterVariant as any).upsert({
            where: {
              id: `${firstChapterVi.id.slice(0, 32)}-v${j}`,
            },
            update: {
              title: variants[j].title,
              unlockPrice: variants[j].unlockPrice,
              content: variants[j].content,
              orderIndex: j,
              audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${j + 1}.mp3`,
              audioDuration: 300 + j * 60,
            },
            create: {
              id: `${firstChapterVi.id.slice(0, 32)}-v${j}`,
              chapterId: firstChapterVi.id,
              title: variants[j].title,
              unlockPrice: variants[j].unlockPrice,
              content: variants[j].content,
              orderIndex: j,
              audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${j + 1}.mp3`,
              audioDuration: 300 + j * 60,
            },
          });
        }
      }
    }
  }

  console.log('Seeding reviews...');

  for (const story of stories) {
    for (let i = 0; i < seededUsers.length; i += 1) {
      const user = seededUsers[i]!;
      const rating = ((i + story.title.length) % 5) + 1;

      await prisma.review.upsert({
        where: {
          userId_storyId: {
            userId: user.id,
            storyId: story.id,
          },
        },
        update: {
          rating,
          content: `[SEED] ${user.displayName} rated ${story.title} with ${rating} stars.`,
        },
        create: {
          userId: user.id,
          storyId: story.id,
          rating,
          content: `[SEED] ${user.displayName} rated ${story.title} with ${rating} stars.`,
        },
      });
    }

    const aggregate = await prisma.review.aggregate({
      where: { storyId: story.id },
      _avg: { rating: true },
      _count: { _all: true },
    });

    await prisma.story.update({
      where: { id: story.id },
      data: {
        averageRating: new Prisma.Decimal(Number(aggregate._avg.rating || 0).toFixed(2)),
        ratingCount: aggregate._count._all,
      },
    });
  }

  console.log('Seeding user interactions...');

  for (let i = 0; i < seededUsers.length; i += 1) {
    const user = seededUsers[i]!;
    const favoriteStory = stories[i % stories.length]!;
    const historyStory = stories[(i + 1) % stories.length]!;
    const subscribedStory = stories[(i + 2) % stories.length]!;
    const chapterId = firstChapterByStory.get(historyStory.id);

    await prisma.userFavorite.upsert({
      where: {
        userId_storyId: {
          userId: user.id,
          storyId: favoriteStory.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        storyId: favoriteStory.id,
      },
    });

    await prisma.userStorySubscription.upsert({
      where: {
        userId_storyId: {
          userId: user.id,
          storyId: subscribedStory.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        storyId: subscribedStory.id,
      },
    });

    if (chapterId) {
      await (prisma.listeningHistory as any).deleteMany({
        where: {
          userId: user.id,
          chapterId,
          variantId: null,
        },
      });

      await (prisma.listeningHistory as any).create({
        data: {
          userId: user.id,
          storyId: historyStory.id,
          chapterId,
          variantId: null,
          progressSeconds: 120 + i * 35,
          lastListenedAt: new Date(Date.now() - i * 3600 * 1000),
        },
      });
    }
  }

  console.log('✅ Seed completed!');
  console.log(`📊 Summary:`);
  console.log(`   - ${categories.length} categories (${categories.filter(c => c.language === 'vi').length} VI, ${categories.filter(c => c.language === 'en').length} EN)`);
  console.log(`   - ${stories.length} stories (${stories.filter(s => s.language === 'vi').length} VI, ${stories.filter(s => s.language === 'en').length} EN)`);
  console.log(`   - ${stories.length * 15} chapters total`);
  console.log(`   - ${seededUsers.length} demo users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
