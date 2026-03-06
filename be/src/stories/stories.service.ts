import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoryStatus } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ExploreQueryDto } from './dto/explore-query.dto';

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeStory(story: any) {
    return {
      ...story,
      totalViews: typeof story.totalViews === 'bigint' ? Number(story.totalViews) : story.totalViews,
    };
  }

  async getHomeStories() {
    const storyInclude = {
      author: {
        select: {
          id: true,
          name: true,
        },
      },
      categories: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    } satisfies Prisma.StoryInclude;

    const [trending, newest, featured] = await Promise.all([
      this.prisma.story.findMany({
        take: 6,
        orderBy: { totalViews: 'desc' },
        include: storyInclude,
      }),
      this.prisma.story.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: storyInclude,
      }),
      this.prisma.story.findMany({
        take: 5,
        where: { isFeatured: true },
        orderBy: [{ featuredOrder: 'asc' }, { updatedAt: 'desc' }],
        include: storyInclude,
      }),
    ]);

    return {
      trending: trending.map((story) => this.serializeStory(story)),
      newest: newest.map((story) => this.serializeStory(story)),
      featured: featured.map((story) => this.serializeStory(story)),
    };
  }

  async exploreStories(query: ExploreQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.StoryWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as StoryStatus } : {}),
      ...(query.categoryId
        ? {
            categories: {
              some: {
                categoryId: query.categoryId,
              },
            },
          }
        : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
    };

    const orderBy: Prisma.StoryOrderByWithRelationInput =
      query.sort === 'views'
        ? { totalViews: 'desc' }
        : query.sort === 'title_asc'
          ? { title: 'asc' }
          : query.sort === 'chapters_desc'
            ? { chapters: { _count: 'desc' } }
            : { createdAt: 'desc' };

    const [total, stories] = await Promise.all([
      this.prisma.story.count({ where }),
      this.prisma.story.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
          author: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      data: stories.map((story) => this.serializeStory(story)),
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getStoryDetail(slug: string) {
    const story = await this.prisma.story.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        chapters: {
          where: { deletedAt: null },
          orderBy: { chapterNumber: 'asc' },
          select: {
            id: true,
            title: true,
            chapterNumber: true,
            audioDuration: true,
            accessType: true,
          },
        },
      },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    return this.serializeStory(story);
  }

  async getAllCategories() {
    return this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getAllAuthors() {
    return this.prisma.author.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}
