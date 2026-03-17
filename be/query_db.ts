
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.creditTransaction.findMany({
    where: { type: 'spend' },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  for (const tx of transactions) {
    if (tx.referenceId) {
       // Check if referenceId is a story
       const story = await prisma.story.findUnique({ where: { id: tx.referenceId } });
       if (story) {
           console.log(`TX ${tx.id} is for Story: ${story.title} (${story.language}), TotalGifts: ${story.totalGifts}`);
           continue;
       }
       // Check if referenceId is a chapter
       const chapter = await prisma.chapter.findUnique({ 
           where: { id: tx.referenceId },
           include: { story: true }
       });
       if (chapter) {
           console.log(`TX ${tx.id} is for Chapter: ${chapter.title} of Story: ${chapter.story?.title} (${chapter.story?.language}), TotalGifts on Story: ${chapter.story?.totalGifts}`);
           continue;
       }
       console.log(`TX ${tx.id} has referenceId ${tx.referenceId} but NO story/chapter found`);
    } else {
       console.log(`TX ${tx.id} has NO referenceId, description: ${tx.description}`);
    }
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
