import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [storyCount, categoryCount, userCount] = await Promise.all([
    prisma.story.count(),
    prisma.category.count(),
    prisma.user.count(),
  ]);

  console.log('Database check:');
  console.log(`Stories: ${storyCount}`);
  console.log(`Categories: ${categoryCount}`);
  console.log(`Users: ${userCount}`);

  if (storyCount > 0) {
    const stories = await prisma.story.findMany({
      take: 5,
      select: { id: true, title: true, language: true },
    });
    console.log('\nFirst 5 stories:');
    stories.forEach(s => console.log(`  - ${s.title} (${s.language})`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
