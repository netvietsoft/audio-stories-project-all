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

  const buildLongChapterContent = (language: 'vi' | 'en', title: string, chapterNumber: number) => {
    const viSentences = [
      `Trong ${title}, chương ${chapterNumber} mở ra một nhịp thở mới của thế giới tu luyện và những mối liên kết chưa từng được hé lộ.`,
      'Nhân vật chính quan sát từng biến động nhỏ của linh khí, tự nhắc mình rằng một sai lầm nhỏ cũng có thể đổi lấy cái giá rất lớn.',
      'Giữa màn đêm dày, tiếng bước chân vang lên như nhịp trống, báo hiệu một cuộc đối đầu không ai muốn nhưng không thể tránh.',
      'Hắn nhớ lại những lời dặn của sư phụ, giữ tâm trí tỉnh táo để phân biệt đâu là cơ hội và đâu là cạm bẫy.',
      'Khi cánh cửa cổ mở ra, một luồng áp lực vô hình phủ xuống, khiến mọi người phải lùi lại để điều hòa hô hấp.',
      'Mỗi lựa chọn ở thời khắc này đều dẫn đến một tương lai khác, và tương lai nào cũng đòi hỏi bản lĩnh lẫn sự hy sinh.',
      'Những ký ức cũ trỗi dậy, vừa tiếp thêm động lực vừa tạo thành gánh nặng trong từng bước tiến về phía trước.',
      'Trong khoảnh khắc ngắn ngủi, hắn hiểu rằng sức mạnh thật sự không chỉ đến từ cảnh giới mà còn từ khả năng giữ lời hứa.',
      'Không gian rung nhẹ như có ai đó đang quan sát từ xa, nhưng không một ai biết kẻ đứng sau tấm màn ấy là ai.',
      'Kết thúc đoạn đường này, hành trình vẫn chưa hề dễ dàng hơn, chỉ là hắn đã học được cách bình tĩnh trước bão tố.',
    ];

    const enSentences = [
      `In ${title}, chapter ${chapterNumber} opens with a new pulse of the cultivation world and hidden connections waiting to surface.`,
      'The protagonist studies every tiny fluctuation of spiritual energy, reminding himself that one careless choice can cost everything.',
      'Under the heavy night sky, distant footsteps echo like drums, announcing a conflict nobody wants yet nobody can avoid.',
      'He remembers his master\'s advice and keeps his mind steady, separating real opportunities from well-designed traps.',
      'When the ancient gate opens, a silent pressure floods the chamber and forces everyone to breathe with caution.',
      'Each decision in this moment creates a different future, and every future demands courage as well as sacrifice.',
      'Old memories return, offering motivation while also becoming a weight on every step forward.',
      'For a brief instant, he realizes true strength is not only about power level but about keeping promises under pressure.',
      'The air trembles as if someone is watching from far away, yet no one can name the figure behind the curtain.',
      'By the end of this stretch, the journey is not easier, but he has learned how to stay calm inside the storm.',
    ];

    const sentences = language === 'vi' ? viSentences : enSentences;
    const targetWords = 3000 + ((chapterNumber * 131) % 1701);
    const paragraphs: string[] = [];
    let words = 0;
    let sentenceIndex = 0;

    while (words < targetWords) {
      const paragraphLines: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        const sentence = sentences[sentenceIndex % sentences.length]!;
        paragraphLines.push(sentence);
        words += sentence.split(/\s+/).length;
        sentenceIndex += 1;
        if (words >= targetWords) break;
      }
      paragraphs.push(paragraphLines.join(' '));
    }

    return paragraphs.join('\n\n');
  };

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

  // Fetch language IDs for use in seeding
  const viLanguage = await prisma.language.findUnique({ where: { key: 'vi' } });
  const enLanguage = await prisma.language.findUnique({ where: { key: 'en' } });
  
  if (!viLanguage || !enLanguage) {
    throw new Error('Languages not found. Please ensure languages are seeded first.');
  }

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
      pulseBalance: 128500,
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
      pulseBalance: 117400,
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
      pulseBalance: 109300,
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
      pulseBalance: 98200,
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
      pulseBalance: 93100,
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
      pulseBalance: 88700,
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
        pulseBalance: item.pulseBalance,
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
        pulseBalance: item.pulseBalance,
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
    { name: 'Tiên Hiệp', slug: 'tien-hiep', languageId: viLanguage.id, description: 'Thế giới tu luyện huyền bí' },
    { name: 'Xianxia', slug: 'xianxia', languageId: enLanguage.id, description: 'Cultivation fantasy world' },
    { name: 'Kiếm Hiệp', slug: 'kiem-hiep', languageId: viLanguage.id, description: 'Giang hồ ân oán tình thù' },
    { name: 'Wuxia', slug: 'wuxia', languageId: enLanguage.id, description: 'Martial arts world' },
    { name: 'Đô Thị', slug: 'do-thi', languageId: viLanguage.id, description: 'Truyện hiện đại' },
    { name: 'Urban', slug: 'urban', languageId: enLanguage.id, description: 'Modern stories' },
    { name: 'Ngôn Tình', slug: 'ngon-tinh', languageId: viLanguage.id, description: 'Tình cảm lãng mạn' },
    { name: 'Romance', slug: 'romance', languageId: enLanguage.id, description: 'Romantic stories' },
    { name: 'Huyền Huyễn', slug: 'huyen-huyen', languageId: viLanguage.id, description: 'Phiêu lưu kỳ ảo' },
    { name: 'Fantasy', slug: 'fantasy', languageId: enLanguage.id, description: 'Fantasy adventure' },
    { name: 'Action', slug: 'action', languageId: viLanguage.id, description: 'Hành động kịch tính' },
    { name: 'Action', slug: 'action', languageId: enLanguage.id, description: 'Action-packed stories' },
    { name: 'Xuyên Không', slug: 'xuyen-khong', languageId: viLanguage.id, description: 'Du hành thời gian và không gian' },
    { name: 'Isekai', slug: 'isekai', languageId: enLanguage.id, description: 'Otherworld travel' },
    { name: 'Shounen', slug: 'shounen', languageId: viLanguage.id, description: 'Truyện dành cho thiếu niên' },
    { name: 'Shounen', slug: 'shounen', languageId: enLanguage.id, description: 'Boys\' adventure and battle' },
  ];

  const categories = [] as any[];
  for (const cat of categoriesData) {
    const existing = await prisma.category.findFirst({
      where: { slug: cat.slug, language: { id: cat.languageId } },
    });
    
    if (existing) {
      const updated = await prisma.category.update({
        where: { id: existing.id },
        data: { name: cat.name, description: cat.description },
      });
      categories.push(updated);
    } else {
      const created = await prisma.category.create({ 
        data: {
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          language: { connect: { id: cat.languageId } }
        }
      });
      categories.push(created);
    }
  }

  console.log('Seeding labels...');
  const labelsData = [
    { name: 'Hot', text: 'HOT', color: '#E4572E', defaultDurationDays: 7 },
    { name: 'New', text: 'NEW', color: '#2E86E4', defaultDurationDays: 14 },
    { name: "Editor's Choice", text: 'EDITOR', color: '#7C3AED', defaultDurationDays: null },
  ];
  for (const lb of labelsData) {
    await prisma.label.upsert({
      where: { name: lb.name },
      update: { text: lb.text, color: lb.color, defaultDurationDays: lb.defaultDurationDays },
      create: lb,
    });
  }

  console.log('Seeding authors...');

  const authorNames = ['Thần Đồng', 'Thiên Tàm Thổ Đậu', 'Dương Gia Tam Thiếu', 'Mộng Nhập Thần Cơ', 'Ngã Cật Tây Hồng Thị'];

  const authors = [] as Awaited<ReturnType<typeof prisma.author.upsert>>[];
  for (const name of authorNames) {
    const author = await prisma.author.upsert({
      where: { slug: slugify(name) },
      update: {
        name,
        language: { connect: { id: viLanguage.id } },
      },
      create: {
        name,
        slug: slugify(name),
        language: { connect: { id: viLanguage.id } },
      },
    });
    authors.push(author);
  }

  console.log('Seeding stories and chapters...');

  const storySeed = [
    // Existing stories
    { vi: 'Phàm Nhân Tu Tiên', en: 'A Record of a Mortal Journey to Immortality' },
    { vi: 'Đấu Phá Thương Khung', en: 'Battle Through the Heavens' },
    { vi: 'Tiên Nghịch', en: 'Renegade Immortal' },
    { vi: 'Nhất Niệm Vĩnh Hằng', en: 'A Will Eternal' },
    { vi: 'Tinh Thần Biến', en: 'Stellar Transformations' },
    { vi: 'Truyện Tương Tác Demo', en: 'Interactive Story Demo', isInteractive: true },
    { vi: 'Mê Cung Ánh Trăng', en: 'Moonlit Labyrinth', isInteractive: true },
    { vi: 'Nhật Ký Cỗ Máy Thời Gian', en: 'Chronicle of the Time Engine', isInteractive: true },
    { vi: 'Lời Nguyền Thư Viện Cổ', en: 'Curse of the Ancient Library', isInteractive: true },
    { vi: 'Đêm Cuối Ở Thành Phố Gương', en: 'Last Night in Mirror City', isInteractive: true },
    { vi: 'Võ Luyện Đỉnh Phong', en: 'Martial Peak' },
    { vi: 'Toàn Chức Pháp Sư', en: 'Versatile Mage' },
    { vi: 'Tuyệt Thế Đường Môn', en: 'Soul Land 2' },
    { vi: 'Vũ Động Càn Khôn', en: 'Wu Dong Qian Kun' },
    { vi: 'Thế Giới Hoàn Mỹ', en: 'Perfect World' },
    { vi: 'Chuông Gió', en: 'Wind Chime' },
    { vi: 'Đạo Quân', en: 'Daoist Lord' },
    { vi: 'Đại Chúa Tể', en: 'The Great Ruler' },
    { vi: 'Linh Chu', en: 'Spirit Boat' },
    { vi: 'Kiếm Đạo Độc Tôn', en: 'Sword Dao Alone' },
    { vi: 'Ngã Dục Phong Thiên', en: 'I Shall Seal the Heavens' },
    { vi: 'Đế Bá', en: 'Emperor\'s Domination' },
    
    // Additional stories for more variety (7 more per category)
    { vi: 'Thần Mộ', en: 'Tomb of the Gods' },
    { vi: 'Bàn Long', en: 'Coiling Dragon' },
    { vi: 'Thiên Hỏa Đại Đạo', en: 'Heavenly Fire Avenue' },
    { vi: 'Linh Vực', en: 'Spirit Realm' },
    { vi: 'Thái Cổ Thần Vương', en: 'Ancient Godly Monarch' },
    { vi: 'Long Vương Truyền Thuyết', en: 'Dragon King Legend' },
    { vi: 'Nguyên Tôn', en: 'Yuan Venerate' },
    { vi: 'Huyết Ma Nhân', en: 'Blood Demon' },
    { vi: 'Thiên Tàm Biến', en: 'Heavenly Silkworm Transformation' },
    { vi: 'Vạn Cổ Thần Đế', en: 'Eternal God Emperor' },
    { vi: 'Thần Ấn Vương Tọa', en: 'Throne of Seal' },
    { vi: 'Thánh Vương', en: 'Holy King' },
    { vi: 'Vô Thượng Thần Đế', en: 'Supreme God Emperor' },
    { vi: 'Huyền Thiên Chí Tôn', en: 'Profound Heaven Supreme' },
    { vi: 'Đế Tôn', en: 'Emperor Supreme' },
    { vi: 'Thần Võ Chiến Tôn', en: 'Divine Martial War Sovereign' },
    { vi: 'Vạn Giới Thần Chủ', en: 'Lord of Myriad Realms' },
    { vi: 'Thái Hư', en: 'Great Void' },
    { vi: 'Hồng Hoang Nguyên Đạo', en: 'Primordial Origin Dao' },
    { vi: 'Vô Địch Thiên Hạ', en: 'Invincible Under Heaven' },
    { vi: 'Thần Ma Đế Quốc', en: 'Divine Demon Empire' },
    { vi: 'Kiếm Tôn', en: 'Sword Sovereign' },
    { vi: 'Hỏa Vũ Chiến Thần', en: 'Fire Martial War God' },
    { vi: 'Vô Song Kiếm Tôn', en: 'Peerless Sword Sovereign' },
    { vi: 'Thần Đạo Đan Tôn', en: 'Divine Dao Pill Sovereign' },
    { vi: 'Vạn Đạo Long Hoàng', en: 'Myriad Dao Dragon Emperor' },
    { vi: 'Thái Cổ Kiếm Tôn', en: 'Ancient Sword Sovereign' },
    { vi: 'Huyền Thiên Võ Đế', en: 'Profound Heaven Martial Emperor' },
    { vi: 'Vô Cực Kiếm Thánh', en: 'Limitless Sword Saint' },
    { vi: 'Thần Võ Thiên Tôn', en: 'Divine Martial Heavenly Sovereign' },
    { vi: 'Đế Vương Truyền Kỳ', en: 'Emperor Legend' },
    { vi: 'Vạn Cổ Kiếm Đế', en: 'Eternal Sword Emperor' },
    { vi: 'Thần Ma Chiến Tôn', en: 'Divine Demon War Sovereign' },
    { vi: 'Huyền Thiên Đế Tôn', en: 'Profound Heaven Emperor Sovereign' },
    { vi: 'Vô Thượng Kiếm Đạo', en: 'Supreme Sword Dao' },
    { vi: 'Thái Cổ Thần Ma', en: 'Ancient God Demon' },
    { vi: 'Vạn Giới Kiếm Tôn', en: 'Myriad Realms Sword Sovereign' },
    { vi: 'Thần Đạo Đế Tôn', en: 'Divine Dao Emperor Sovereign' },
    { vi: 'Huyền Thiên Chiến Đế', en: 'Profound Heaven War Emperor' },
    { vi: 'Vô Địch Kiếm Thần', en: 'Invincible Sword God' },
    { vi: 'Thần Võ Đế Quốc', en: 'Divine Martial Empire' },
    { vi: 'Vạn Đạo Thần Tôn', en: 'Myriad Dao God Sovereign' },
    { vi: 'Thái Cổ Chiến Thần', en: 'Ancient War God' },
    { vi: 'Huyền Thiên Thần Đế', en: 'Profound Heaven God Emperor' },
    { vi: 'Vô Song Đế Tôn', en: 'Peerless Emperor Sovereign' },
    { vi: 'Thần Ma Vô Thượng', en: 'Divine Demon Supreme' },
    { vi: 'Vạn Cổ Chiến Đế', en: 'Eternal War Emperor' },
    { vi: 'Thần Đạo Vô Cực', en: 'Divine Dao Limitless' },
    { vi: 'Huyền Thiên Kiếm Tôn', en: 'Profound Heaven Sword Sovereign' },
    { vi: 'Vô Thượng Chiến Thần', en: 'Supreme War God' },
    
    // 18 new stories (6 completed per language)
    { vi: 'Thiên Địa Bá Chủ', en: 'Heaven and Earth Overlord' },
    { vi: 'Vạn Kiếm Quy Tông', en: 'Ten Thousand Swords Return' },
    { vi: 'Huyền Thiên Bảo Lục', en: 'Profound Heaven Treasure Record' },
    { vi: 'Thần Ma Đại Chiến', en: 'Divine Demon Great War' },
    { vi: 'Vô Cực Thần Tôn', en: 'Limitless God Sovereign' },
    { vi: 'Thái Cổ Long Tộc', en: 'Ancient Dragon Clan' },
    { vi: 'Huyền Thiên Huyết Chiến', en: 'Profound Heaven Blood War' },
    { vi: 'Vạn Đạo Kiếm Đế', en: 'Myriad Dao Sword Emperor' },
    { vi: 'Thần Võ Vô Song', en: 'Divine Martial Peerless' },
    { vi: 'Hỏa Vũ Đế Tôn', en: 'Fire Martial Emperor Sovereign' },
    { vi: 'Vô Địch Chiến Thần', en: 'Invincible War God' },
    { vi: 'Thái Cổ Đế Quốc', en: 'Ancient Empire' },
    { vi: 'Huyền Thiên Ma Đế', en: 'Profound Heaven Demon Emperor' },
    { vi: 'Vạn Giới Chiến Tôn', en: 'Myriad Realms War Sovereign' },
    { vi: 'Thần Đạo Kiếm Thánh', en: 'Divine Dao Sword Saint' },
    { vi: 'Vô Thượng Ma Đế', en: 'Supreme Demon Emperor' },
    { vi: 'Thái Cổ Huyền Tôn', en: 'Ancient Profound Sovereign' },
    { vi: 'Huyền Thiên Vạn Kiếm', en: 'Profound Heaven Ten Thousand Swords' },
  ];

  const stories = [] as Awaited<ReturnType<typeof prisma.story.upsert>>[];
  const firstChapterByStory = new Map<string, string>();

  for (let i = 0; i < storySeed.length; i += 1) {
    const storyData = storySeed[i]!;
    const isInteractiveStory = Boolean((storyData as { isInteractive?: boolean }).isInteractive);
    
    const titleVi = storyData.vi;
    const slugVi = slugify(titleVi);
    const descriptionVi = isInteractiveStory
      ? `${titleVi} mở ra một câu chuyện tương tác nơi mỗi lựa chọn sẽ dẫn đến một nhánh diễn biến hoàn toàn khác nhau. Bạn sẽ quyết định cách nhân vật tiếp cận bí ẩn, đối thoại với đồng minh và đối đầu với những rủi ro không thể lường trước. Mỗi đoạn chuyển cảnh đều được xây dựng với tiết tấu chậm rãi, chi tiết giàu hình ảnh và cảm xúc để phù hợp trải nghiệm đọc dài hơi khi kiểm thử giao diện.`
      : `${titleVi} - truyện audio tiếng Việt dùng để kiểm tra giao diện và chức năng cập nhật chương.`;
    
    const existingVi = await prisma.story.findFirst({
      where: { slug: slugVi, language: { id: viLanguage.id } },
    });

    const storyVi = existingVi
      ? await prisma.story.update({
          where: { id: existingVi.id },
          data: {
            title: titleVi,
            language: { connect: { id: viLanguage.id } },
            author: { connect: { id: authors[i % authors.length].id } },
            status: i % 3 === 0 ? 'completed' : 'ongoing',
            thumbnailUrl: `https://picsum.photos/seed/story-vi-${i + 1}/600/900`,
            totalViews: isInteractiveStory ? BigInt(830000 + i * 15000) : BigInt(200000 + i * 45000),
            isFeatured: i < 3,
            isRecommended: i % 2 === 0,
            isInteractive: isInteractiveStory,
            featuredOrder: i < 3 ? i + 1 : null,
            description: descriptionVi,
          },
        })
      : await prisma.story.create({
          data: {
            title: titleVi,
            slug: slugVi,
            language: { connect: { id: viLanguage.id } },
            author: { connect: { id: authors[i % authors.length].id } },
            status: i % 3 === 0 ? 'completed' : 'ongoing',
            thumbnailUrl: `https://picsum.photos/seed/story-vi-${i + 1}/600/900`,
            totalViews: isInteractiveStory ? BigInt(830000 + i * 15000) : BigInt(200000 + i * 45000),
            isFeatured: i < 3,
            isRecommended: i % 2 === 0,
            isInteractive: isInteractiveStory,
            featuredOrder: i < 3 ? i + 1 : null,
            description: descriptionVi,
          },
        });

    await prisma.storyCategory.deleteMany({ where: { storyId: storyVi.id } });
    const viCats = categories.filter(c => c.languageId === viLanguage.id);
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
    const descriptionEn = isInteractiveStory
      ? `${titleEn} is an interactive narrative where each choice branches into a different emotional and strategic outcome. Readers can test long-form content rendering while moving through decision points that change alliances, pacing, and consequences. The description is intentionally long so UI truncation, spacing, and responsive composition can be validated under realistic conditions.`
      : `${titleEn} - English audio story for interface and chapter update testing.`;
    
    const existingEn = await prisma.story.findFirst({
      where: { slug: slugEn, language: { id: enLanguage.id } },
    });

    const storyEn = existingEn
      ? await prisma.story.update({
          where: { id: existingEn.id },
          data: {
            title: titleEn,
            language: { connect: { id: enLanguage.id } },
            author: { connect: { id: authors[i % authors.length].id } },
            status: i % 3 === 0 ? 'completed' : 'ongoing',
            thumbnailUrl: `https://picsum.photos/seed/story-en-${i + 1}/600/900`,
            totalViews: isInteractiveStory ? BigInt(760000 + i * 12000) : BigInt(180000 + i * 40000),
            isFeatured: i < 3,
            isRecommended: i % 2 === 1,
            isInteractive: isInteractiveStory,
            featuredOrder: i < 3 ? i + 6 : null,
            description: descriptionEn,
          },
        })
      : await prisma.story.create({
          data: {
            title: titleEn,
            slug: slugEn,
            language: { connect: { id: enLanguage.id } },
            author: { connect: { id: authors[i % authors.length].id } },
            status: i % 3 === 0 ? 'completed' : 'ongoing',
            thumbnailUrl: `https://picsum.photos/seed/story-en-${i + 1}/600/900`,
            totalViews: isInteractiveStory ? BigInt(760000 + i * 12000) : BigInt(180000 + i * 40000),
            isFeatured: i < 3,
            isRecommended: i % 2 === 1,
            isInteractive: isInteractiveStory,
            featuredOrder: i < 3 ? i + 6 : null,
            description: descriptionEn,
          },
        });

    await prisma.storyCategory.deleteMany({ where: { storyId: storyEn.id } });
    const enCats = categories.filter(c => c.languageId === enLanguage.id);
    await prisma.storyCategory.createMany({
      data: [
        { storyId: storyEn.id, categoryId: enCats[i % enCats.length].id },
        { storyId: storyEn.id, categoryId: enCats[(i + 1) % enCats.length].id },
      ],
      skipDuplicates: true,
    });

    stories.push(storyEn);

    const chapterTotal = isInteractiveStory ? 1 : 15;
    for (let chapterNumber = 1; chapterNumber <= chapterTotal; chapterNumber += 1) {
      const chapterSeed = i * 20 + chapterNumber;
      const content = buildLongChapterContent('vi', titleVi, chapterNumber);

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
          language: { connect: { id: viLanguage.id } },
          description: chapterDescription,
          thumbnailUrl: chapterThumb,
          content,
          r2AudioUrl: chapterAudio,
          youtubeVideoId: chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
          isInteractive: isInteractiveStory && chapterNumber === 1 ? true : false,
        },
        create: {
          story: { connect: { id: storyVi.id } },
          chapterNumber,
          title: chapterTitle,
          language: { connect: { id: viLanguage.id } },
          description: chapterDescription,
          thumbnailUrl: chapterThumb,
          content,
          r2AudioUrl: chapterAudio,
          youtubeVideoId: chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
          isInteractive: isInteractiveStory && chapterNumber === 1 ? true : false,
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

    if (isInteractiveStory) {
      await prisma.chapter.deleteMany({
        where: {
          storyId: storyVi.id,
          chapterNumber: { gt: chapterTotal },
        },
      });
    }

    for (let chapterNumber = 1; chapterNumber <= chapterTotal; chapterNumber += 1) {
      const chapterSeed = i * 20 + chapterNumber + 100;
      const content = buildLongChapterContent('en', titleEn, chapterNumber);

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
          language: { connect: { id: enLanguage.id } },
          description: chapterDescription,
          thumbnailUrl: chapterThumb,
          content,
          r2AudioUrl: chapterAudio,
          youtubeVideoId: chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
          isInteractive: isInteractiveStory && chapterNumber === 1 ? true : false,
        },
        create: {
          story: { connect: { id: storyEn.id } },
          chapterNumber,
          title: chapterTitle,
          language: { connect: { id: enLanguage.id } },
          description: chapterDescription,
          thumbnailUrl: chapterThumb,
          content,
          r2AudioUrl: chapterAudio,
          youtubeVideoId: chapterNumber % 3 === 0 ? 'dQw4w9WgXcQ' : null,
          audioDuration: 540 + chapterNumber * 12,
          accessType,
          unlocksAt,
          isInteractive: isInteractiveStory && chapterNumber === 1 ? true : false,
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

    if (isInteractiveStory) {
      await prisma.chapter.deleteMany({
        where: {
          storyId: storyEn.id,
          chapterNumber: { gt: chapterTotal },
        },
      });
    }

    if (isInteractiveStory) {
      const firstChapterVi = await prisma.chapter.findFirst({
        where: { storyId: storyVi.id, chapterNumber: 1 },
      });

      if (firstChapterVi) {
        console.log(`Seeding variants for ${titleVi} Chapter 1...`);
        const variants = [
          {
            title: 'Path A: Tiếp cận trong im lặng',
            unlockPrice: 0,
            content: 'Bạn quyết định lẻn vào từng bước, kiểm tra đường thoát trước khi tiến sâu hơn vào khu vực cấm. Mỗi âm thanh nhỏ đều khiến bạn chững lại để quan sát dấu vết, ghi nhớ sơ đồ hành lang và suy luận hướng di chuyển của đối phương. Khi vượt qua cánh cửa đầu tiên, bạn nhận ra nơi này không chỉ là một kho lưu trữ, mà còn là tâm điểm của những giao kèo chưa từng được công khai. [DIEN_BIEN] Sau khi lẻn vào, bạn thấy hai cánh cửa hiện ra trước mắt cùng những ký hiệu cổ xếp thành một câu đố nhiều tầng.',
          },
          {
            title: 'Path B: The Direct Confrontation',
            unlockPrice: 100,
            content: 'You move in directly and choose pressure over stealth, forcing the people in front of you to react before they can complete their plan. The confrontation escalates through layered dialogue, tactical feints, and a sequence of quick choices that can expose hidden loyalties. The more you push forward, the more likely you are to uncover immediate truth at the cost of future trust.',
          },
          {
            title: 'Path C: The Secret Alliance',
            unlockPrice: 200,
            content: 'You open with negotiation and attempt to build a quiet alliance with someone who should have been your enemy. The conversation is long, filled with half-truths, old debts, and veiled warnings about what lies beneath the city archives. If your wording is precise, this branch reveals critical background lore and unlocks safer but morally complex outcomes.',
          },
        ];

        for (let j = 0; j < variants.length; j++) {
          const variantId = `${firstChapterVi.id.slice(0, 32)}-v${j}`;
          await (prisma.chapterVariant as any).upsert({
            where: { id: variantId },
            update: {
              title: variants[j].title,
              unlockPrice: variants[j].unlockPrice,
              content: variants[j].content,
              orderIndex: j,
              audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${j + 1}.mp3`,
              audioDuration: 300 + j * 60,
            },
            create: {
              id: variantId,
              chapterId: firstChapterVi.id,
              title: variants[j].title,
              unlockPrice: variants[j].unlockPrice,
              content: variants[j].content,
              orderIndex: j,
              audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${j + 1}.mp3`,
              audioDuration: 300 + j * 60,
            },
          });

          // Add sub-variants for Path A (index 0)
          if (j === 0) {
            const subVariants = [
              { title: 'A.1: Mở cửa bên trái', unlockPrice: 0, content: 'Bạn mở cửa bên trái và thấy một rương vàng lấp lánh.' },
              { title: 'A.2: Mở cửa bên phải', unlockPrice: 50, content: 'Bạn mở cửa bên phải và bắt gặp một con mèo đen đang nhìn chằm chằm.' },
            ];

            for (let k = 0; k < subVariants.length; k++) {
              await (prisma.chapterVariant as any).upsert({
                where: {
                  id: `${variantId.slice(0, 30)}-sb${k}`,
                },
                update: {
                  title: subVariants[k].title,
                  unlockPrice: subVariants[k].unlockPrice,
                  content: subVariants[k].content,
                  orderIndex: k,
                },
                create: {
                  id: `${variantId.slice(0, 30)}-sb${k}`,
                  chapterId: firstChapterVi.id,
                  title: subVariants[k].title,
                  unlockPrice: subVariants[k].unlockPrice,
                  content: subVariants[k].content,
                  orderIndex: k,
                },
              });
            }
          }
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

  console.log('Seeding advertisements...');

  const adSeeds = [
    {
      partnerName: 'Shopee',
      title: 'Tai nghe Bluetooth chống ồn cho người mê audio story',
      imageUrl: 'https://images.unsplash.com/photo-1545127398-14699f92334b?auto=format&fit=crop&w=900&q=80',
      targetUrl: 'https://shopee.vn/',
      isActive: true,
    },
    {
      partnerName: 'Lazada',
      title: 'Loa mini pin trâu, âm trầm mạnh cho phòng ngủ',
      imageUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=900&q=80',
      targetUrl: 'https://www.lazada.vn/',
      isActive: true,
    },
    {
      partnerName: 'Tiki',
      title: 'Combo sách fantasy + bookmark phiên bản giới hạn',
      imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80',
      targetUrl: 'https://tiki.vn/',
      isActive: true,
    },
    {
      partnerName: 'FPT Shop',
      title: 'Máy đọc sách màn e-ink, đọc lâu không mỏi mắt',
      imageUrl: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
      targetUrl: 'https://fptshop.com.vn/',
      isActive: true,
    },
    {
      partnerName: 'CellphoneS',
      title: 'Pin sạc dự phòng dung lượng lớn cho hành trình dài',
      imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80',
      targetUrl: 'https://cellphones.com.vn/',
      isActive: false,
    },
  ];

  await prisma.advertisement.deleteMany({});
  await prisma.advertisement.createMany({ data: adSeeds });

  console.log('Seeding music tracks...');

  const musicSeeds = [
    {
      title: 'Night Rain Lofi',
      artist: 'Netviet Studio',
      thumbnailUrl: 'https://picsum.photos/seed/music-seed-1/640/640',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      audioDuration: 348,
      isPublic: true,
    },
    {
      title: 'Piano Sunrise',
      artist: 'Netviet Studio',
      thumbnailUrl: 'https://picsum.photos/seed/music-seed-2/640/640',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      audioDuration: 361,
      isPublic: true,
    },
    {
      title: 'Coastline Drift',
      artist: 'Netviet Studio',
      thumbnailUrl: 'https://picsum.photos/seed/music-seed-3/640/640',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      audioDuration: 332,
      isPublic: true,
    },
    {
      title: 'Deep Breath',
      artist: 'Netviet Studio',
      thumbnailUrl: 'https://picsum.photos/seed/music-seed-4/640/640',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      audioDuration: 289,
      isPublic: true,
    },
    {
      title: 'Late Night Focus',
      artist: 'Ambient Guild',
      thumbnailUrl: 'https://picsum.photos/seed/music-seed-5/640/640',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      audioDuration: 305,
      isPublic: true,
    },
    {
      title: 'Calm Meadow',
      artist: 'Ambient Guild',
      thumbnailUrl: 'https://picsum.photos/seed/music-seed-6/640/640',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
      audioDuration: 317,
      isPublic: false,
    },
  ].map((item, index) => ({
    ...item,
    slug: `${slugify(item.title)}-${index + 1}`,
  }));

  await prisma.music.deleteMany({});
  await prisma.music.createMany({ data: musicSeeds });

  console.log('Seeding system configs...');

  await prisma.systemConfig.upsert({
    where: { key: 'ad_insertion_frequency' },
    update: { value: '1000' },
    create: {
      key: 'ad_insertion_frequency',
      value: '1000',
    },
  });

  console.log('✅ Seed completed!');
  console.log(`📊 Summary:`);
  console.log(`   - ${categories.length} categories (${categories.filter(c => c.languageId === viLanguage.id).length} VI, ${categories.filter(c => c.languageId === enLanguage.id).length} EN)`);
  console.log(`   - ${stories.length} stories (${stories.filter(s => s.languageId === viLanguage.id).length} VI, ${stories.filter(s => s.languageId === enLanguage.id).length} EN)`);
  console.log(`   - ${stories.length * 15} chapters total`);
  console.log(`   - ${seededUsers.length} demo users`);
  console.log(`   - ${adSeeds.length} advertisements`);
  console.log(`   - ${musicSeeds.length} music tracks`);
  console.log('   - 1 system config (ad_insertion_frequency)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
