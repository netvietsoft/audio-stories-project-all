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

  const paragraphTemplates = [
    'Trời đêm phủ kín dãy núi, tiếng gió thổi qua khe đá nghe như lời thì thầm cổ xưa. Nhân vật chính ngồi tĩnh tọa, cố giữ tâm thần bình ổn giữa linh khí cuộn trào.',
    'Trong khoảnh khắc mở mắt, hắn cảm nhận được mạch khí vận hành nhanh hơn trước gấp bội. Một tia sáng mỏng như tơ lướt qua đầu ngón tay, báo hiệu cảnh giới đã có dấu hiệu đột phá.',
    'Nhưng ngay khi niềm vui vừa chớm nở, uy áp từ xa đã ập tới như thủy triều. Một bóng người lạ đứng trên đỉnh vách đá, mang theo khí tức khiến cả sơn cốc chìm vào im lặng.',
    'Hắn hít sâu một hơi, nắm chặt chuôi kiếm rồi bước từng bước chậm rãi. Dù kết cục chưa rõ, đêm nay nhất định phải mở ra chương mới cho vận mệnh của chính mình.',
  ];

  for (let storyIndex = 0; storyIndex < stories.length; storyIndex += 1) {
    const story = stories[storyIndex]!;

    for (let chapterNumber = 1; chapterNumber <= 18; chapterNumber += 1) {
      const chapterSeed = storyIndex * 20 + chapterNumber;
      const paragraphCount = 3 + (chapterNumber % 2);
      const content = Array.from({ length: paragraphCount }, (_, idx) => {
        const template = paragraphTemplates[(chapterNumber + idx) % paragraphTemplates.length]!;
        return `[Đoạn ${idx + 1}] ${template}`;
      }).join('\n\n');

      const accessType = chapterNumber % 9 === 0 ? 'vip' : chapterNumber % 4 === 0 ? 'timed' : 'free';
      const unlocksAt =
        accessType === 'timed'
          ? new Date(Date.now() + ((chapterNumber % 5) + 1) * 24 * 60 * 60 * 1000)
          : null;
      const youtubeVideoId = chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null;

      await prisma.chapter.upsert({
        where: {
          storyId_chapterNumber: {
            storyId: story.id,
            chapterNumber,
          },
        },
        update: {
          title: `Chương ${chapterNumber}: Biến chuyển linh lực`,
          content,
          r2AudioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(chapterSeed % 16) + 1}.mp3`,
          youtubeVideoId,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
        },
        create: {
          storyId: story.id,
          chapterNumber,
          title: `Chương ${chapterNumber}: Biến chuyển linh lực`,
          content,
          r2AudioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(chapterSeed % 16) + 1}.mp3`,
          youtubeVideoId,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
        },
      });
    }
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
