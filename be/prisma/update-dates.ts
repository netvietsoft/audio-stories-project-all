import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stories = await prisma.story.findMany();
  console.log(`Found ${stories.length} stories.`);

  // Stagger the updatedAt dates
  // 3 stories: today (last 12 hours)
  // 5 stories: within last 3 days
  // 6 stories: within last 15 days
  // Rest: 60 days ago

  const now = new Date();

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];
    let newDate;
    if (i < 3) {
      newDate = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago
    } else if (i < 8) {
      newDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    } else if (i < 14) {
      newDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
    } else {
      newDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    }

    await prisma.story.update({
      where: { id: story.id },
      data: { updatedAt: newDate, publishedAt: newDate },
    });
  }

  console.log('Successfully staggered updatedAt dates.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
