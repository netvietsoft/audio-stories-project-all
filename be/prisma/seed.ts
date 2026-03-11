import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import prismaConfig from './prisma.config';

const prisma = new PrismaClient(prismaConfig);

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
      credits: 1200,
      vipTier: 1,
      vipExpirationDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      allowEmailNoti: true,
      allowBellNoti: true,
    },
    {
      email: 'reader2@seed.local',
      displayName: 'Reader Two',
      credits: 700,
      vipTier: 0,
      vipExpirationDate: null,
      allowEmailNoti: false,
      allowBellNoti: true,
    },
    {
      email: 'reader3@seed.local',
      displayName: 'Reader Three',
      credits: 450,
      vipTier: 0,
      vipExpirationDate: null,
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
        credits: item.credits,
        vipTier: item.vipTier,
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
        vipTier: item.vipTier,
        vipExpirationDate: item.vipExpirationDate,
        emailVerifiedAt: new Date(),
        roleId: userRole.id,
        allowEmailNoti: item.allowEmailNoti,
        allowBellNoti: item.allowBellNoti,
      },
    });

    seededUsers.push({ id: user.id, email: user.email, displayName: user.displayName });
  }

  console.log('Seeding categories, authors, stories, chapters...');

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'tien-hiep' },
      update: {},
      create: { name: 'Tien Hiep', slug: 'tien-hiep', description: 'The gioi tu luyen huyen bi' },
    }),
    prisma.category.upsert({
      where: { slug: 'kiem-hiep' },
      update: {},
      create: { name: 'Kiem Hiep', slug: 'kiem-hiep', description: 'Giang ho an oan tinh thu' },
    }),
    prisma.category.upsert({
      where: { slug: 'do-thi' },
      update: {},
      create: { name: 'Do Thi', slug: 'do-thi', description: 'Truyen hien dai' },
    }),
    prisma.category.upsert({
      where: { slug: 'ngon-tinh' },
      update: {},
      create: { name: 'Ngon Tinh', slug: 'ngon-tinh', description: 'Tinh cam lang man' },
    }),
    prisma.category.upsert({
      where: { slug: 'huyen-huyen' },
      update: {},
      create: { name: 'Huyen Huyen', slug: 'huyen-huyen', description: 'Phieu luu ky ao' },
    }),
  ]);

  const authorNames = ['Than Dong', 'Thien Tam Tho Dau', 'Duong Gia Tam Thieu', 'Mong Nhap Than Co', 'Nga Cat Tay Hong Thi'];

  const authors = [] as Awaited<ReturnType<typeof prisma.author.upsert>>[];
  for (const name of authorNames) {
    const author = await prisma.author.upsert({
      where: { slug: slugify(name) },
      update: { name },
      create: { name, slug: slugify(name) },
    });
    authors.push(author);
  }

  const storySeed = [
    'Pham Nhan Tu Tien',
    'Dau Pha Thuong Khung',
    'Tien Nghich',
    'Nhat Niem Vinh Hang',
    'Tinh Than Bien',
    'The Gioi Hoan My',
    'Long Vuong Truyen Thuyet',
    'Dai Chua Te',
    'Vu Dong Can Khon',
    'Ta Co Mot Toa Thanh',
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
    const title = storySeed[i]!;
    const story = await prisma.story.upsert({
      where: { slug: slugify(title) },
      update: {
        title,
        authorId: authors[i % authors.length].id,
        status: i % 3 === 0 ? 'completed' : 'ongoing',
        thumbnailUrl: `https://picsum.photos/seed/story-${i + 1}/600/900`,
        totalViews: BigInt(200000 + i * 45000),
        isFeatured: i < 5,
        isRecommended: i % 2 === 0,
        featuredOrder: i < 5 ? i + 1 : null,
        description: `${title} - audio story sample`,
      },
      create: {
        title,
        slug: slugify(title),
        authorId: authors[i % authors.length].id,
        status: i % 3 === 0 ? 'completed' : 'ongoing',
        thumbnailUrl: `https://picsum.photos/seed/story-${i + 1}/600/900`,
        totalViews: BigInt(200000 + i * 45000),
        isFeatured: i < 5,
        isRecommended: i % 2 === 0,
        featuredOrder: i < 5 ? i + 1 : null,
        description: `${title} - audio story sample`,
      },
    });

    await prisma.storyCategory.deleteMany({ where: { storyId: story.id } });
    await prisma.storyCategory.createMany({
      data: [
        { storyId: story.id, categoryId: categories[i % categories.length].id },
        { storyId: story.id, categoryId: categories[(i + 1) % categories.length].id },
      ],
      skipDuplicates: true,
    });

    for (let chapterNumber = 1; chapterNumber <= 18; chapterNumber += 1) {
      const chapterSeed = i * 20 + chapterNumber;
      const paragraphCount = 3 + (chapterNumber % 2);
      const content = Array.from({ length: paragraphCount }, (_, idx) => {
        const template = paragraphTemplates[(chapterNumber + idx) % paragraphTemplates.length]!;
        return `[Paragraph ${idx + 1}] ${template}`;
      }).join('\n\n');

      const accessType = chapterNumber % 9 === 0 ? 'vip' : chapterNumber % 4 === 0 ? 'timed' : 'free';
      const unlocksAt = accessType === 'timed'
        ? new Date(Date.now() + ((chapterNumber % 5) + 1) * 24 * 60 * 60 * 1000)
        : null;

      const chapter = await prisma.chapter.upsert({
        where: {
          storyId_chapterNumber: {
            storyId: story.id,
            chapterNumber,
          },
        },
        update: {
          title: `Chapter ${chapterNumber}: Spirit Shift`,
          content,
          r2AudioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(chapterSeed % 16) + 1}.mp3`,
          youtubeVideoId: chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
        },
        create: {
          storyId: story.id,
          chapterNumber,
          title: `Chapter ${chapterNumber}: Spirit Shift`,
          content,
          r2AudioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(chapterSeed % 16) + 1}.mp3`,
          youtubeVideoId: chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
        },
      });

      if (chapterNumber === 1) {
        firstChapterByStory.set(story.id, chapter.id);
      }
    }

    await prisma.story.update({
      where: { id: story.id },
      data: { totalChapters: 18 },
    });

    stories.push(story);
  }

  console.log('Seeding reviews and rating summary...');

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

  console.log('Seeding favorites, history, comments, and reactions...');

  for (let i = 0; i < seededUsers.length; i += 1) {
    const user = seededUsers[i]!;
    const favoriteStory = stories[i % stories.length]!;
    const historyStory = stories[(i + 1) % stories.length]!;
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

    if (chapterId) {
      await prisma.listeningHistory.upsert({
        where: {
          userId_chapterId: {
            userId: user.id,
            chapterId,
          },
        },
        update: {
          storyId: historyStory.id,
          progressSeconds: 120 + i * 35,
          lastListenedAt: new Date(Date.now() - i * 3600 * 1000),
        },
        create: {
          userId: user.id,
          storyId: historyStory.id,
          chapterId,
          progressSeconds: 120 + i * 35,
          lastListenedAt: new Date(Date.now() - i * 3600 * 1000),
        },
      });
    }
  }

  await prisma.chapterComment.deleteMany({
    where: {
      content: { startsWith: '[SEED]' },
    },
  });

  const parentComments: Array<{ id: string; chapterId: string; storyId: string }> = [];
  for (let i = 0; i < Math.min(3, stories.length); i += 1) {
    const story = stories[i]!;
    const chapterId = firstChapterByStory.get(story.id);
    if (!chapterId) continue;

    const owner = seededUsers[i % seededUsers.length]!;
    const replyUser = seededUsers[(i + 1) % seededUsers.length]!;

    const parent = await prisma.chapterComment.create({
      data: {
        userId: owner.id,
        chapterId,
        storyId: story.id,
        content: `[SEED] Main comment for ${story.title}`,
        timestampSeconds: null,
      },
    });

    await prisma.chapterComment.create({
      data: {
        userId: replyUser.id,
        chapterId,
        storyId: story.id,
        parentId: parent.id,
        content: `[SEED] Reply comment for ${story.title}`,
        timestampSeconds: null,
      },
    });

    parentComments.push({ id: parent.id, chapterId, storyId: story.id });
  }

  for (let i = 0; i < parentComments.length; i += 1) {
    const comment = parentComments[i]!;
    const user = seededUsers[i % seededUsers.length]!;
    await prisma.commentReaction.upsert({
      where: {
        userId_commentId_type: {
          userId: user.id,
          commentId: comment.id,
          type: 'helpful',
        },
      },
      update: {},
      create: {
        userId: user.id,
        commentId: comment.id,
        type: 'helpful',
      },
    });

    await prisma.chapterComment.update({
      where: { id: comment.id },
      data: { likesCount: 1 },
    });
  }

  console.log('Seeding transactions, memberships, notifications...');

  const userIds = seededUsers.map((u) => u.id);

  await prisma.payment.deleteMany({
    where: {
      userId: { in: userIds },
      transactionCode: { startsWith: 'SEED-TX-' },
    },
  });

  await prisma.creditTransaction.deleteMany({
    where: {
      userId: { in: userIds },
      description: { startsWith: '[SEED]' },
    },
  });

  await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notification.deleteMany({
    where: {
      userId: { in: userIds },
      title: { startsWith: '[SEED]' },
    },
  });

  for (let i = 0; i < seededUsers.length; i += 1) {
    const user = seededUsers[i]!;
    const author = authors[i % authors.length]!;

    await prisma.payment.create({
      data: {
        userId: user.id,
        packageCode: `PKG_${i + 1}`,
        amountVnd: 99000 + i * 50000,
        creditsAdded: 1000 + i * 500,
        status: i % 2 === 0 ? 'SUCCESS' : 'PENDING',
        transactionCode: `SEED-TX-${i + 1}`,
        paidAt: i % 2 === 0 ? new Date() : null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await prisma.creditTransaction.createMany({
      data: [
        {
          userId: user.id,
          type: 'topup',
          amount: 1000 + i * 500,
          balanceBefore: 0,
          balanceAfter: 1000 + i * 500,
          description: `[SEED] Topup for ${user.displayName}`,
        },
        {
          userId: user.id,
          type: 'spend',
          amount: -(150 + i * 20),
          balanceBefore: 1000 + i * 500,
          balanceAfter: 850 + i * 480,
          description: `[SEED] Unlock chapter spend for ${user.displayName}`,
        },
      ],
    });

    await prisma.membership.create({
      data: {
        userId: user.id,
        type: i % 2 === 0 ? 'all_authors' : 'specific_author',
        authorId: i % 2 === 0 ? null : author.id,
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
        creditsSpent: 299 + i * 100,
      },
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: user.id,
          type: 'new_chapter',
          title: '[SEED] New chapter available',
          body: `Story ${stories[i % stories.length]!.title} has a new chapter.`,
          isRead: false,
        },
        {
          userId: user.id,
          type: 'transaction',
          title: '[SEED] Transaction update',
          body: 'Your topup transaction is recorded successfully.',
          isRead: i % 2 === 0,
        },
        {
          userId: user.id,
          type: 'membership_expiry',
          title: '[SEED] Membership expiring soon',
          body: 'Your membership will expire in less than 72 hours.',
          isRead: false,
        },
      ],
    });
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
