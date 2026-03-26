import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get a story with 2 chapters
  const stories = await prisma.story.findMany({
    where: {
      deletedAt: null,
    },
    include: {
      chapters: {
        where: { deletedAt: null },
        orderBy: { chapterNumber: 'asc' },
        select: {
          id: true,
          chapterNumber: true,
          title: true,
        },
      },
    },
    take: 5,
  });

  console.log('\n=== Stories with Chapters ===\n');
  
  for (const story of stories) {
    console.log(`Story: ${story.title} (${story.slug})`);
    console.log(`Chapters (${story.chapters.length}):`);
    story.chapters.forEach((ch, idx) => {
      console.log(`  [${idx}] chapterNumber: ${ch.chapterNumber}, title: ${ch.title}, id: ${ch.id}`);
    });
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
