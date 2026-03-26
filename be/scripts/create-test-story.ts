import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a test story with exactly 2 chapters
  const story = await prisma.story.upsert({
    where: { 
      slug_language: {
        slug: 'test-2-chapters',
        language: 'vi',
      }
    },
    update: {},
    create: {
      title: 'Truyện Test - 2 Chương',
      slug: 'test-2-chapters',
      description: 'Một truyện test với đúng 2 chương để kiểm tra bug',
      thumbnailUrl: 'https://picsum.photos/seed/test-story/600/600',
      status: 'ongoing',
      language: 'vi',
      totalViews: 0,
      averageRating: 0,
      ratingCount: 0,
      authorId: (await prisma.author.findFirst())?.id || '',
    },
  });

  console.log('Created story:', story.title, story.slug);

  // Delete existing chapters
  await prisma.chapter.deleteMany({
    where: { storyId: story.id },
  });

  // Create chapter 1
  const chapter1 = await prisma.chapter.create({
    data: {
      storyId: story.id,
      chapterNumber: 1,
      title: 'Tiêu đề Chương 1',
      language: 'vi',
      description: 'Đây là chương 1',
      content: 'Nội dung chương 1. Đây là chương đầu tiên. Khi bạn bấm vào chương 1, bạn phải thấy nội dung này.',
      r2AudioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      audioDuration: 300,
      accessType: 'free',
    },
  });

  console.log('Created chapter 1:', chapter1.chapterNumber, chapter1.title);

  // Create chapter 2
  const chapter2 = await prisma.chapter.create({
    data: {
      storyId: story.id,
      chapterNumber: 2,
      title: 'Tiêu đề Chương 2',
      language: 'vi',
      description: 'Đây là chương 2',
      content: 'Nội dung chương 2. Đây là chương thứ hai. Khi bạn bấm vào chương 2, bạn phải thấy nội dung này.',
      r2AudioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      audioDuration: 300,
      accessType: 'free',
    },
  });

  console.log('Created chapter 2:', chapter2.chapterNumber, chapter2.title);

  // Verify
  const storyWithChapters = await prisma.story.findUnique({
    where: { id: story.id },
    include: {
      chapters: {
        orderBy: { chapterNumber: 'asc' },
        select: {
          id: true,
          chapterNumber: true,
          title: true,
        },
      },
    },
  });

  console.log('\n=== Verification ===');
  console.log('Story:', storyWithChapters?.title);
  console.log('Chapters:');
  storyWithChapters?.chapters.forEach((ch, idx) => {
    console.log(`  [${idx}] chapterNumber: ${ch.chapterNumber}, title: ${ch.title}, id: ${ch.id}`);
  });

  console.log('\n✅ Test story created successfully!');
  console.log(`Visit: /story/test-2-chapters`);
  console.log(`Chapter 1: /story/test-2-chapters/chuong-1`);
  console.log(`Chapter 2: /story/test-2-chapters/chuong-2`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
