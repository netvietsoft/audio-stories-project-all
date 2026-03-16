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
    {
      vi: 'Pham Nhan Lang Thang Qua Chinh Do Ma Vuc De Tim Con Duong Truong Sinh Bat Diet',
      en: 'A Mortal Wanderer Crossing the Demon Empire Frontier in Search of an Undying Ascension Path',
    },
    {
      vi: 'Thieu Nien Bi Truc Xuat Khoi Tong Mon Va Bat Dau Cuoc Hanh Trinh Dot Pha Cuu Tang Troi',
      en: 'The Young Exile Who Left the Sect and Began a Journey to Burn Through Nine Heavens',
    },
    {
      vi: 'Nguoi Giu Kiem Co Don Tren Vung Hoang Mac Va Loi The Phan Nghich Cua Tien Dao',
      en: 'The Lone Sword Keeper of the Wasteland and the Rebellious Oath Against the Immortal Dao',
    },
    {
      vi: 'Mot Y Niem Vinh Hang Giua Tram Tran Kiep Nan Va Hanh Trinh Bao Ve Nguoi Than Yeu',
      en: 'One Eternal Thought Amid Endless Calamities and a Journey to Protect the Ones He Loves',
    },
    {
      vi: 'Tinh Than Co Dai Thuc Tinh Trong Co The Yeo Duoi Cua Thieu Nien Bi Lang Quen',
      en: 'Ancient Star Blood Awakens Inside the Frail Body of a Boy the World Has Forgotten',
    },
    {
      vi: 'The Gioi Hoan My Sau Dai Tuyet Tan The Va Cuoc Tro Ve Cua Ke So Huu Huyet Mach Than',
      en: 'Perfect World After the Great Snowfall and the Return of the Heir to a Divine Bloodline',
    },
    {
      vi: 'Long Vuong Ngu Tren Bien Sau Tinh Day Truoc Dai Chien Cua Tram Thanh Tri Co Dai',
      en: 'The Sleeping Dragon King Wakes Before the Grand War of a Hundred Ancient Strongholds',
    },
    {
      vi: 'Dai Chua Te Tre Tuoi Va Ban Do Quyen Luc Dang Lam Rung Chuyen Ca Tam Gioi',
      en: 'The Young Great Ruler and the Expanding Map of Power That Shakes All Three Realms',
    },
    {
      vi: 'Vu Dong Can Khon Cua Ke Tro Ve Tu Vuc Sau Va Hanh Trinh Thanh Lap De Che Moi',
      en: 'Martial Cosmos of the Survivor Who Returned from the Abyss to Build a New Dominion',
    },
    {
      vi: 'Ta So Huu Toa Co Thanh Tan Phe Noi Cat Giau Bi Mat Ve Mot Nen Van Minh Da Mat',
      en: 'I Inherited a Ruined Ancient City That Hides the Final Secret of a Lost Civilization',
    },
  ];

  const stories = [] as Awaited<ReturnType<typeof prisma.story.upsert>>[];
  const firstChapterByStory = new Map<string, string>();

  const paragraphTemplates = [
    'Night covered the mountain and spirit energy was flowing quickly around the valley.',
    'He opened his eyes and felt his cultivation pulse move faster than before.',
    'A strange pressure arrived from afar and the whole canyon became silent.',
    'He held his sword and decided to move forward despite uncertain outcome.',
  ];

  const buildLongStoryIntroduction = (language: 'vi' | 'en', title: string, authorName: string) => {
    const viSentences = [
      `${title} mở ra bằng một thời đại hỗn loạn nơi biên giới giữa tiên môn, ma vực và thế tục không còn ranh giới rõ ràng nữa.`,
      `Nhân vật chính bước vào câu chuyện với thân phận nhỏ bé nhưng luôn mang trong tim khát vọng đổi vận, bảo vệ người thân và tìm ra ý nghĩa thật sự của sức mạnh.`,
      `Mỗi chặng đường đều được bồi đắp bằng những cuộc gặp gỡ nhiều tầng cảm xúc, những trận chiến căng thẳng và vô số quyết định khiến vận mệnh của cả một vùng trời thay đổi.`,
      `Điểm nổi bật của truyện là nhịp kể chậm rãi nhưng dồn lực, liên tục mở rộng thế giới quan, chiều sâu tâm lý và những bí mật cổ xưa được chôn vùi qua nhiều thế hệ.`,
      `Tác giả ${authorName} xây dựng hành trình trưởng thành bằng các lớp mâu thuẫn về tình thân, danh vọng, niềm tin, phản bội và sự cô độc của người đứng trước lựa chọn không có đường lui.`,
      `Phần giới thiệu này được kéo dài để phục vụ kiểm thử giao diện, vì vậy mỗi đoạn đều chủ ý có độ dài lớn, câu chữ nhiều nhịp và lượng thông tin dày để quan sát cách hiển thị trên nhiều kích thước màn hình.`,
      `Khi theo dõi truyện, người đọc sẽ liên tục bắt gặp những cổ thành đổ nát, chiến trường bỏ hoang, truyền thừa thất lạc, dị bảo thức tỉnh và các thế lực đang âm thầm tranh đoạt quyền khống chế tương lai.`,
      `Không chỉ là một câu chuyện tu luyện hay phiêu lưu, đây còn là hành trình nhìn lại bản thân, trả giá cho tham vọng, học cách tin tưởng và chấp nhận rằng mọi lựa chọn đều để lại vết hằn lâu dài.`,
      `Các mối quan hệ trong truyện được phát triển theo hướng nhiều lớp, lúc là đồng minh, lúc là đối thủ, lúc lại trở thành chiếc gương phản chiếu những giới hạn sâu kín nhất của nhân vật chính.`,
      `Càng tiến xa, câu chuyện càng làm rõ câu hỏi cốt lõi rằng sức mạnh tối thượng có thực sự mang lại tự do, hay chỉ đẩy con người vào một vòng xoáy trách nhiệm khắc nghiệt hơn trước.`,
    ];

    const enSentences = [
      `${title} begins in a fractured age where the borders between immortal factions, demonic territories, and mortal kingdoms have almost completely dissolved.`,
      `The protagonist enters the narrative with little status, yet carries an unshakable desire to change fate, protect loved ones, and understand what power is truly meant for.`,
      `Every stage of the journey is shaped by layered encounters, tense confrontations, and choices that gradually alter the destiny of an entire world.`,
      `The story stands out because it expands its universe with deliberate pacing, emotional weight, and ancient secrets that were buried across many generations.`,
      `Author ${authorName} frames the path of growth through conflicts involving loyalty, ambition, family bonds, betrayal, and the loneliness of standing before irreversible decisions.`,
      `This introduction is intentionally long for interface testing, so each paragraph carries extra density, flowing rhythm, and enough text volume to stress real layouts across breakpoints.`,
      `Readers repeatedly encounter ruined strongholds, abandoned battlefields, sleeping inheritances, awakening relics, and rival powers struggling to control the shape of the future.`,
      `More than a cultivation saga or adventure fantasy, the novel becomes a meditation on identity, consequence, sacrifice, and the burden of carrying hope for others.`,
      `Its relationships unfold in layers, shifting from alliance to rivalry and sometimes becoming mirrors that expose the most private limits of the central character.`,
      `As the plot widens, the central question becomes sharper: does ultimate strength create freedom, or does it merely lock a person inside harsher responsibilities than before.`,
    ];

    const sentencePool = language === 'vi' ? viSentences : enSentences;
    const targetWordCount = 4000;
    const words: string[] = [];
    let paragraphIndex = 0;

    while (words.length < targetWordCount) {
      const paragraph = Array.from({ length: 5 }, (_, sentenceIndex) => {
        const baseSentence = sentencePool[(paragraphIndex + sentenceIndex) % sentencePool.length]!;
        return `${baseSentence} ${language === 'vi' ? `Doan mo rong ${paragraphIndex + 1} nhan manh them chieu sau cua boi canh, nhan vat va xung dot trung tam de nguoi doc cam nhan duoc quy mo that su cua tac pham.` : `Expansion passage ${paragraphIndex + 1} reinforces the depth of the setting, character arcs, and central conflict so the interface can be tested with realistic narrative density.`}`;
      }).join(' ');

      words.push(...paragraph.split(/\s+/));
      paragraphIndex += 1;
    }

    return words.slice(0, targetWordCount).join(' ');
  };

  for (let i = 0; i < storySeed.length; i += 1) {
    const titleVi = storySeed[i]!.vi;
    const titleEn = storySeed[i]!.en;
    const title = titleVi;
    const storyLang = 'multi';
    const chapterTotal = i >= storySeed.length - 2 ? 0 : 18;
    const authorName = authors[i % authors.length].name;
    const storyDescriptionVi = buildLongStoryIntroduction('vi', titleVi, authorName);
    const storyDescriptionEn = buildLongStoryIntroduction('en', titleEn, authorName);

    const story = await prisma.story.upsert({
      where: { slug: slugify(title) },
      update: {
        title,
        titleVi,
        titleEn,
        language: storyLang,
        authorId: authors[i % authors.length].id,
        status: i % 3 === 0 ? 'completed' : 'ongoing',
        thumbnailUrl: `https://picsum.photos/seed/story-${i + 1}/600/900`,
        totalViews: BigInt(200000 + i * 45000),
        isFeatured: i < 5,
        isRecommended: i % 2 === 0,
        featuredOrder: i < 5 ? i + 1 : null,
        description: storyDescriptionVi,
        descriptionVi: storyDescriptionVi,
        descriptionEn: storyDescriptionEn,
      },
      create: {
        title,
        titleVi,
        titleEn,
        slug: slugify(title),
        language: storyLang,
        authorId: authors[i % authors.length].id,
        status: i % 3 === 0 ? 'completed' : 'ongoing',
        thumbnailUrl: `https://picsum.photos/seed/story-${i + 1}/600/900`,
        totalViews: BigInt(200000 + i * 45000),
        isFeatured: i < 5,
        isRecommended: i % 2 === 0,
        featuredOrder: i < 5 ? i + 1 : null,
        description: storyDescriptionVi,
        descriptionVi: storyDescriptionVi,
        descriptionEn: storyDescriptionEn,
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

    for (let chapterNumber = 1; chapterNumber <= chapterTotal; chapterNumber += 1) {
      const chapterSeed = i * 20 + chapterNumber;
      const paragraphCount = 3 + (chapterNumber % 2);
      const contentVi = Array.from({ length: paragraphCount }, (_, idx) => {
        const template = paragraphTemplates[(chapterNumber + idx) % paragraphTemplates.length]!;
        return `[Paragraph ${idx + 1}] ${template}`;
      }).join('\n\n');
      const contentEn = Array.from({ length: paragraphCount }, (_, idx) => {
        const template = paragraphTemplates[(chapterNumber + idx + 1) % paragraphTemplates.length]!;
        return `[Paragraph ${idx + 1}] ${template}`;
      }).join('\n\n');

      const chapterTitleVi = `Chuong ${chapterNumber}: Chuyen dong linh luc`;
      const chapterTitleEn = `Chapter ${chapterNumber}: Spirit Shift`;
      const chapterDescriptionVi = `Gioi thieu chuong ${chapterNumber} cua ${titleVi}`;
      const chapterDescriptionEn = `Chapter ${chapterNumber} introduction of ${titleEn}`;
      const chapterAudio = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(chapterSeed % 16) + 1}.mp3`;
      const chapterThumb = `https://picsum.photos/seed/chapter-${i + 1}-${chapterNumber}/320/320`;

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
          title: chapterTitleVi,
          titleVi: chapterTitleVi,
          titleEn: chapterTitleEn,
          description: chapterDescriptionVi,
          descriptionVi: chapterDescriptionVi,
          descriptionEn: chapterDescriptionEn,
          thumbnailUrl: chapterThumb,
          content: contentVi,
          contentVi,
          contentEn,
          r2AudioUrl: chapterAudio,
          audioUrlVi: chapterAudio,
          audioUrlEn: chapterAudio,
          youtubeVideoId: chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
        },
        create: {
          storyId: story.id,
          chapterNumber,
          title: chapterTitleVi,
          titleVi: chapterTitleVi,
          titleEn: chapterTitleEn,
          description: chapterDescriptionVi,
          descriptionVi: chapterDescriptionVi,
          descriptionEn: chapterDescriptionEn,
          thumbnailUrl: chapterThumb,
          content: contentVi,
          contentVi,
          contentEn,
          r2AudioUrl: chapterAudio,
          audioUrlVi: chapterAudio,
          audioUrlEn: chapterAudio,
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
      data: { totalChapters: chapterTotal },
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
  await prisma.userStorySubscription.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notification.deleteMany({
    where: {
      userId: { in: userIds },
      title: { startsWith: '[SEED]' },
    },
  });

  for (let i = 0; i < seededUsers.length; i += 1) {
    const user = seededUsers[i]!;
    const author = authors[i % authors.length]!;
    const subscribedStory = stories[i % stories.length]!;

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
          title: '[SEED] Story update subscription',
          body: `Bạn đang nhận cập nhật cho truyện ${subscribedStory.title}. Khi có chương mới hoặc cập nhật nội dung, thông báo sẽ hiện ở đây.`,
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
