import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoryStatus } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ExploreQueryDto } from './dto/explore-query.dto';
import { CreateStoryDto } from './dto/create-story.dto';

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(data: CreateStoryDto) {
    const { categoryIds, chapters, chapterIds, ...storyData } = data;

    const story = await this.prisma.story.create({
      data: {
        ...storyData,
        categories: categoryIds
          ? {
            create: categoryIds.map((id) => ({
              categoryId: id,
            })),
          }
          : undefined,
        totalChapters: (chapters?.length || 0) + (chapterIds?.length || 0),
        chapters: chapters?.length
          ? {
            create: chapters,
          }
          : undefined,
      },
      include: {
        author: {
          select: { id: true, name: true },
        },
        categories: {
          include: {
            category: { select: { name: true } },
          },
        },
      },
    });

    // Assign existing chapters to this story if chapterIds provided
    if (chapterIds && chapterIds.length > 0) {
      await this.prisma.chapter.updateMany({
        where: {
          id: { in: chapterIds },
          storyId: null, // Only assign chapters that are not already assigned
        },
        data: {
          storyId: story.id,
        },
      });
    }

    return this.serializeStory(story);
  }


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
      ...(query.search
        ? {
          OR: [
            { title: { contains: query.search } },
            { author: { name: { contains: query.search } } },
          ],
        }
        : {}),
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
        select: {
          id: true,
          slug: true,
          title: true,
          thumbnailUrl: true,
          status: true,
          totalViews: true,
          authorId: true,
        },
      }),
    ]);

    const authorIds = [...new Set(stories.map((story) => story.authorId).filter(Boolean))];
    const authors = authorIds.length
      ? await this.prisma.author.findMany({
          where: {
            id: {
              in: authorIds,
            },
          },
          select: {
            id: true,
            name: true,
          },
        })
      : [];

    const authorMap = new Map(authors.map((author) => [author.id, author]));

    const normalizedStories = stories.map((story) => ({
      ...story,
      author: authorMap.get(story.authorId) ?? undefined,
    }));

    return {
      data: normalizedStories.map((story) => this.serializeStory(story)),
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findAllAdmin(query: ExploreQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.StoryWhereInput = {
      // Admin sees everything (including soft deleted if needed, but let's stick to non-deleted for now)
      deletedAt: null,
      ...(query.status ? { status: query.status as StoryStatus } : {}),
      ...(query.search
        ? {
          OR: [
            { title: { contains: query.search } },
            { author: { name: { contains: query.search } } },
          ],
        }
        : {}),
    };

    const [total, stories] = await Promise.all([
      this.prisma.story.count({ where }),
      this.prisma.story.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, name: true },
          },
          categories: {
            include: {
              category: { select: { name: true } },
            },
          },
          _count: {
            select: { chapters: true },
          },
        },
      }),
    ]);

    return {
      data: stories.map((s) => this.serializeStory(s)),
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
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
            content: true,
            r2AudioUrl: true,
            youtubeVideoId: true,
            audioDuration: true,
            accessType: true,
            unlocksAt: true,
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
