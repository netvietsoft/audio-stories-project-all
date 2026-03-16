import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting soft-deleted stories permanently...\n');

  const softDeleted = await prisma.story.findMany({
    where: {
      deletedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      titleVi: true,
      titleEn: true,
      deletedAt: true,
    },
  });

  console.log(`Found ${softDeleted.length} soft-deleted stories:`);
  softDeleted.forEach((s, i) => {
    console.log(`${i + 1}. ${s.titleVi || s.titleEn || s.title} (deleted at: ${s.deletedAt})`);
  });

  if (softDeleted.length === 0) {
    console.log('\nNo soft-deleted stories to remove.');
    return;
  }

  console.log('\nPermanently deleting these stories...');
  
  const result = await prisma.story.deleteMany({
    where: {
      deletedAt: { not: null },
    },
  });

  console.log(`\n✓ Successfully deleted ${result.count} stories permanently.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
