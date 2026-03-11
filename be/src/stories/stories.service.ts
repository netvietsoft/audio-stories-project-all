import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoryStatus } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ExploreQueryDto } from './dto/explore-query.dto';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

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
          deletedAt: null,
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

  async getRecommendedStories(limit = 12) {
    const safeLimit = Math.min(Math.max(limit || 12, 1), 15);
    const stories = await this.prisma.story.findMany({
      where: {
        deletedAt: null,
        isRecommended: true,
      },
      take: safeLimit,
      orderBy: [{ updatedAt: 'desc' }, { totalViews: 'desc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        thumbnailUrl: true,
        status: true,
        totalViews: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      data: stories.map((story) => this.serializeStory(story)),
    };
  }

  async exploreStories(query: ExploreQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const now = new Date();
    const trendWindowStart =
      query.trendWindow === 'today'
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
        : query.trendWindow === 'week'
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          : query.trendWindow === 'month'
            ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            : null;

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
      ...(trendWindowStart ? { updatedAt: { gte: trendWindowStart } } : {}),
    };

    const orderBy: Prisma.StoryOrderByWithRelationInput =
      query.sort === 'views'
        ? { totalViews: 'desc' }
        : query.sort === 'rating'
          ? { averageRating: 'desc' }
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
          averageRating: true,
          createdAt: true,
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

  async getTopCategories(limit = 5) {
    const safeLimit = Math.min(Math.max(limit || 5, 1), 20);
    const grouped = await this.prisma.storyCategory.groupBy({
      by: ['categoryId'],
      _count: {
        storyId: true,
      },
      orderBy: {
        _count: {
          storyId: 'desc',
        },
      },
      take: safeLimit,
    });

    const ids = grouped.map((item) => item.categoryId);
    const categories = ids.length
      ? await this.prisma.category.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      })
      : [];

    const categoryMap = new Map(categories.map((item) => [item.id, item]));
    return {
      data: grouped
        .map((item) => {
          const category = categoryMap.get(item.categoryId);
          if (!category) return null;
          return {
            ...category,
            storiesCount: item._count.storyId,
          };
        })
        .filter(Boolean),
    };
  }

  async getHallOfFame(limit = 3) {
    const safeLimit = Math.min(Math.max(limit || 3, 1), 20);
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        vipTier: { gt: 0 },
      },
      orderBy: [{ vipTier: 'desc' }, { credits: 'desc' }, { totalUnlockedStories: 'desc' }],
      take: safeLimit,
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        vipTier: true,
        credits: true,
        totalUnlockedStories: true,
      },
    });

    return {
      data: users,
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

    const isAll = query.all === 'true';

    const [total, stories] = await Promise.all([
      this.prisma.story.count({ where }),
      this.prisma.story.findMany({
        where,
        ...(isAll ? {} : {
          skip: (page - 1) * limit,
          take: limit,
        }),
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

  async findOneAdmin(id: string) {
    const story = await this.prisma.story.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true },
        },
        categories: {
          include: {
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!story || story.deletedAt) {
      throw new NotFoundException('Story not found');
    }

    return this.serializeStory(story);
  }

  async updateStory(id: string, data: UpdateStoryDto) {
    const existing = await this.prisma.story.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Story not found');
    }

    const { categoryIds, ...storyData } = data;

    if (categoryIds) {
      await this.prisma.storyCategory.deleteMany({ where: { storyId: id } });
      if (categoryIds.length > 0) {
        await this.prisma.storyCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            storyId: id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await this.prisma.story.update({
      where: { id },
      data: storyData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        categories: {
          include: {
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    return this.serializeStory(updated);
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
            description: true,
            thumbnailUrl: true,
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

  async getAllCategoriesWithCount() {
    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            stories: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      data: categories.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        storiesCount: item._count.stories,
      })),
    };
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

  async updateRecommended(id: string, isRecommended: boolean) {
    const existing = await this.prisma.story.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Story not found');
    }

    const updated = await this.prisma.story.update({
      where: { id },
      data: { isRecommended },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return this.serializeStory(updated);
  }
}
