import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking all stories in database...\n');

  const allStories = await prisma.story.findMany({
    select: {
      id: true,
      title: true,
      language: true,
      deletedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Total stories in DB: ${allStories.length}\n`);

  const activeStories = allStories.filter(s => !s.deletedAt);
  const deletedStories = allStories.filter(s => s.deletedAt);

  console.log(`Active stories: ${activeStories.length}`);
  console.log(`Deleted stories: ${deletedStories.length}\n`);

  console.log('Stories by language:');
  const byLanguage = activeStories.reduce((acc, s) => {
    acc[s.language] = (acc[s.language] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(byLanguage);

  console.log('\nAll stories:');
  allStories.forEach((s, i) => {
    console.log(`${i + 1}. ${s.title} (lang: ${s.language}, deleted: ${s.deletedAt ? 'YES' : 'NO'})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
