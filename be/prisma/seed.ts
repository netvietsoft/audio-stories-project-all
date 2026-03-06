import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding roles...');

  // Create default roles if not exist
  await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: {
      name: 'USER',
      slug: 'user',
      description: 'Default user role',
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      slug: 'admin',
      description: 'Administrator role',
    },
  });

  console.log('Created default roles');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@media-ai.app';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    if (existingAdmin.roleId !== adminRole.id) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { roleId: adminRole.id },
      });
      console.log(`Assigned ADMIN role to existing user: ${adminEmail}`);
    } else {
      console.log(`Admin user already exists: ${adminEmail}`);
    }
  } else {
    const passwordHash = await argon2.hash(adminPassword);
    await prisma.user.create({
      data: {
        email: adminEmail,
        displayName: 'Admin',
        passwordHash: passwordHash,
        emailVerifiedAt: new Date(),
        roleId: adminRole.id,
      },
    });

    console.log(`Created admin user: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
  }

  console.log('Seeding categories, authors, stories, chapters...');

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'tien-hiep' },
      update: {},
      create: { name: 'Tiên Hiệp', slug: 'tien-hiep', description: 'Thế giới tu luyện huyền bí' },
    }),
    prisma.category.upsert({
      where: { slug: 'kiem-hiep' },
      update: {},
      create: { name: 'Kiếm Hiệp', slug: 'kiem-hiep', description: 'Giang hồ ân oán tình thù' },
    }),
    prisma.category.upsert({
      where: { slug: 'do-thi' },
      update: {},
      create: { name: 'Đô Thị', slug: 'do-thi', description: 'Truyện đời sống thành thị hiện đại' },
    }),
    prisma.category.upsert({
      where: { slug: 'ngon-tinh' },
      update: {},
      create: { name: 'Ngôn Tình', slug: 'ngon-tinh', description: 'Tình cảm lãng mạn' },
    }),
    prisma.category.upsert({
      where: { slug: 'huyen-huyen' },
      update: {},
      create: { name: 'Huyền Huyễn', slug: 'huyen-huyen', description: 'Phiêu lưu kỳ ảo' },
    }),
  ]);

  const authorNames = [
    'Thần Đông',
    'Thiên Tằm Thổ Đậu',
    'Đường Gia Tam Thiếu',
    'Mộng Nhập Thần Cơ',
    'Ngã Cật Tây Hồng Thị',
  ];

  const authors = [] as Awaited<ReturnType<typeof prisma.author.upsert>>[];
  for (const name of authorNames) {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const author = await prisma.author.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });

    authors.push(author);
  }

  const storySeed = [
    'Phàm Nhân Tu Tiên',
    'Đấu Phá Thương Khung',
    'Tiên Nghịch',
    'Nhất Niệm Vĩnh Hằng',
    'Tinh Thần Biến',
    'Thế Giới Hoàn Mỹ',
    'Long Vương Truyền Thuyết',
    'Đại Chúa Tể',
    'Vũ Động Càn Khôn',
    'Ta Có Một Tòa Thành',
  ];

  const stories = [] as Awaited<ReturnType<typeof prisma.story.upsert>>[];

  for (let i = 0; i < storySeed.length; i += 1) {
    const title = storySeed[i]!;
    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const story = await prisma.story.upsert({
      where: { slug },
      update: {
        title,
        authorId: authors[i % authors.length].id,
        status: i % 3 === 0 ? 'completed' : 'ongoing',
        thumbnailUrl: `https://picsum.photos/seed/story-${i + 1}/600/900`,
        totalViews: BigInt(200000 + i * 45000),
        isFeatured: i < 5,
        featuredOrder: i < 5 ? i + 1 : null,
      },
      create: {
        title,
        slug,
        authorId: authors[i % authors.length].id,
        status: i % 3 === 0 ? 'completed' : 'ongoing',
        thumbnailUrl: `https://picsum.photos/seed/story-${i + 1}/600/900`,
        totalViews: BigInt(200000 + i * 45000),
        isFeatured: i < 5,
        featuredOrder: i < 5 ? i + 1 : null,
        description: `${title} - bản audio chất lượng cao`,
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

    stories.push(story);
  }

  for (let i = 0; i < 20; i += 1) {
    const story = stories[i % stories.length];
    const chapterNumber = i + 1;

    await prisma.chapter.upsert({
      where: {
        storyId_chapterNumber: {
          storyId: story.id,
          chapterNumber,
        },
      },
      update: {
        title: `Chương ${chapterNumber}`,
        r2AudioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 16) + 1}.mp3`,
        audioDuration: 600 + i * 7,
        accessType: i % 5 === 0 ? 'vip' : 'free',
      },
      create: {
        storyId: story.id,
        chapterNumber,
        title: `Chương ${chapterNumber}`,
        r2AudioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 16) + 1}.mp3`,
        audioDuration: 600 + i * 7,
        accessType: i % 5 === 0 ? 'vip' : 'free',
      },
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
