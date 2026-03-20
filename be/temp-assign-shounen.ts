
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const shounen = await prisma.category.findFirst({
      where: { slug: 'shounen', language: 'vi' }
    });

    if (!shounen) {
      console.error('Shounen category not found');
      return;
    }

    const firstStory = await prisma.story.findFirst({
      where: { language: 'vi' }
    });

    if (!firstStory) {
      console.error('No story found');
      return;
    }

    await prisma.storyCategory.create({
      data: {
        storyId: firstStory.id,
        categoryId: shounen.id
      }
    }).catch(() => console.log('Story already in Shounen category'));

    console.log(`Assigned story "${firstStory.title}" to Shounen category.`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
