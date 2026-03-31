import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to fix recommended stories...');

  // Set all stories to isRecommended = false first
  await prisma.story.updateMany({
    data: {
      isRecommended: false,
    },
  });
  console.log('Reset all stories isRecommended to false');

  // Get Vietnamese stories with high rating (not necessarily newest)
  const viStories = await prisma.story.findMany({
    where: {
      language: 'vi',
      deletedAt: null,
      averageRating: {
        gte: 4.0, // Only stories with rating >= 4.0
      },
    },
    orderBy: [
      { averageRating: 'desc' },
      { totalViews: 'desc' },
    ],
    take: 10,
  });

  if (viStories.length > 0) {
    await prisma.story.updateMany({
      where: {
        id: {
          in: viStories.map(s => s.id),
        },
      },
      data: {
        isRecommended: true,
      },
    });
    console.log(`Set ${viStories.length} Vietnamese stories as recommended`);
  }

  // Get English stories with high rating (not necessarily newest)
  const enStories = await prisma.story.findMany({
    where: {
      language: 'en',
      deletedAt: null,
      averageRating: {
        gte: 4.0, // Only stories with rating >= 4.0
      },
    },
    orderBy: [
      { averageRating: 'desc' },
      { totalViews: 'desc' },
    ],
    take: 10,
  });

  if (enStories.length > 0) {
    await prisma.story.updateMany({
      where: {
        id: {
          in: enStories.map(s => s.id),
        },
      },
      data: {
        isRecommended: true,
      },
    });
    console.log(`Set ${enStories.length} English stories as recommended`);
  }

  // Verify the results
  const viRecommended = await prisma.story.count({
    where: {
      language: 'vi',
      isRecommended: true,
      deletedAt: null,
    },
  });

  const enRecommended = await prisma.story.count({
    where: {
      language: 'en',
      isRecommended: true,
      deletedAt: null,
    },
  });

  console.log('\nResults:');
  console.log(`Vietnamese recommended stories: ${viRecommended}`);
  console.log(`English recommended stories: ${enRecommended}`);
  console.log('\nDone!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
