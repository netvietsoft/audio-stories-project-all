import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma, StoryStatus } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ExploreQueryDto } from './dto/explore-query.dto';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

@Injectable()
export class StoriesService {
  private readonly exploreCacheVersionKey = 'stories:explore:version';
  private readonly exploreCacheTtlSeconds = 60;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  private async getExploreCacheVersion() {
    const cachedVersion = await this.cacheManager.get<number>(this.exploreCacheVersionKey);
    if (typeof cachedVersion === 'number' && Number.isFinite(cachedVersion)) {
      return cachedVersion;
    }

    const initialVersion = Date.now();
    await this.cacheManager.set(this.exploreCacheVersionKey, initialVersion, this.exploreCacheTtlSeconds);
    return initialVersion;
  }

  private buildExploreCacheKey(query: ExploreQueryDto, version: number) {
    const normalizedEntries = Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([left], [right]) => left.localeCompare(right));

    return `stories:explore:v${version}:${JSON.stringify(normalizedEntries)}`;
  }

  private async invalidateExploreCache() {
    const nextVersion = Date.now();
    await this.cacheManager.set(this.exploreCacheVersionKey, nextVersion, this.exploreCacheTtlSeconds);
  }

  private normalizeNestedChapterPayload(chapter: any) {
    return {
      ...chapter,
      title: chapter.titleVi || chapter.titleEn || '',
      description: chapter.descriptionVi || chapter.descriptionEn || null,
      content: chapter.contentVi || chapter.contentEn || null,
      r2AudioUrl: chapter.audioUrlVi || chapter.audioUrlEn || chapter.r2AudioUrl || null,
    };
  }

  private normalizeStoryFlatPayload(data: any) {
    return {
      ...data,
      title: data.titleVi || data.titleEn || data.title || '',
      description: data.descriptionVi || data.descriptionEn || data.description || null,
    };
  }

  async create(data: CreateStoryDto) {
    // Validate that at least one title exists
    if (!data.titleVi && !data.titleEn && !data.title) {
      throw new BadRequestException('At least one title (titleVi, titleEn, or title) must be provided');
    }

    const { categoryIds, chapters, chapterIds, ...storyData } = data;

    const normalizedStoryData = this.normalizeStoryFlatPayload(storyData);

    try {
      const story = await this.prisma.story.create({
        data: {
          ...normalizedStoryData,
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
              create: chapters.map((chapter) => this.normalizeNestedChapterPayload(chapter)),
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

      await this.invalidateExploreCache();

      return this.serializeStory(story);
    } catch (error) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        const target = error.meta?.target;
        if (target && target.includes('slug')) {
          throw new BadRequestException(`Slug "${data.slug}" đã tồn tại. Vui lòng sử dụng slug khác.`);
        }
        throw new BadRequestException('Dữ liệu bị trùng lặp. Vui lòng kiểm tra lại.');
      }
      throw error;
    }
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
              nameVi: true,
              nameEn: true,
              slug: true,
            } as any,
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
        titleVi: true,
        titleEn: true,
        thumbnailUrl: true,
        status: true,
        totalViews: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      } as any,
    });

    return {
      data: stories.map((story) => this.serializeStory(story)),
    };
  }

  async exploreStories(query: ExploreQueryDto) {
    const version = await this.getExploreCacheVersion();
    const cacheKey = this.buildExploreCacheKey(query, version);
    const cached = await this.cacheManager.get<{
      data: any[];
      meta: { total: number; page: number; lastPage: number };
    }>(cacheKey);

    if (cached) {
      return cached;
    }

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
      ...(query.lang ? { language: query.lang } : {}),
      ...(query.status ? { status: query.status as StoryStatus } : {}),
      ...(query.search
        ? {
          OR: [
            { title: { contains: query.search } },
            { titleVi: { contains: query.search } },
            { titleEn: { contains: query.search } },
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
    } as any; // Cast the entire where object to any

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
          description: true,
          descriptionVi: true,
          descriptionEn: true,
          thumbnailUrl: true,
          status: true,
          totalViews: true,
          averageRating: true,
          title: true,
          titleVi: true,
          titleEn: true,
          createdAt: true,
          author: {
            select: { name: true },
          },
          categories: {
            include: {
              category: { select: { id: true, name: true, nameVi: true, nameEn: true, slug: true } as any },
            },
          },
        } as any, // Cast the entire select object to any
      }),
    ]);

    const result = {
      data: stories.map((story) => this.serializeStory(story)),
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };

    await this.cacheManager.set(cacheKey, result, this.exploreCacheTtlSeconds);

    return result;
  }

  async getTopCategories(limit = 5, _lang = 'vi') {
    const safeLimit = Math.min(Math.max(limit || 5, 1), 20);
    const grouped = await this.prisma.storyCategory.groupBy({
      by: ['categoryId'],
      where: {
        story: {
          deletedAt: null,
        },
      },
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
          nameVi: true,
          nameEn: true,
          slug: true,
          language: true,
        } as any,
      })
      : [];

    const categoryMap = new Map<number, any>(
      (categories as any[]).map((item) => [item.id, item]),
    );
    return {
      data: (grouped as any[])
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
      // Don't filter by deletedAt in admin - show all stories including soft deleted
      ...(query.status ? { status: query.status as StoryStatus } : {}),
      ...(query.lang ? { language: query.lang } : {}),
      ...(query.search
        ? {
          OR: [
            { title: { contains: query.search } },
            { titleVi: { contains: query.search } },
            { titleEn: { contains: query.search } },
            { author: { name: { contains: query.search } } },
          ],
        }
        : {}),
    } as any;

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
              category: { select: { id: true, name: true, nameVi: true, nameEn: true, slug: true } as any },
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
            category: { select: { id: true, name: true, nameVi: true, nameEn: true, slug: true } as any },
          },
        },
      },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    return this.serializeStory(story);
  }

  async updateStory(id: string, data: UpdateStoryDto) {
    const existing = await this.prisma.story.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!existing) {
      throw new NotFoundException('Story not found');
    }

    const { categoryIds, ...storyData } = data;
    const normalizedStoryData = this.normalizeStoryFlatPayload(storyData);

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
      data: normalizedStoryData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        categories: {
          include: {
            category: { select: { id: true, name: true, nameVi: true, nameEn: true, slug: true } as any },
          },
        },
      },
    });

    await this.invalidateExploreCache();

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
                nameVi: true,
                nameEn: true,
                slug: true,
              } as any,
            },
          },
        },
        chapters: {
          where: { deletedAt: null },
          orderBy: { chapterNumber: 'asc' },
          select: {
            id: true,
            title: true,
            titleVi: true,
            titleEn: true,
            audioUrlVi: true,
            audioUrlEn: true,
            youtubeVideoId: true,
            audioDuration: true,
            chapterNumber: true,
            description: true,
            descriptionVi: true,
            descriptionEn: true,
            thumbnailUrl: true,
            content: true,
            contentVi: true,
            contentEn: true,
            r2AudioUrl: true,
            accessType: true,
            unlocksAt: true,
          } as any,
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
        nameVi: true,
        nameEn: true,
        slug: true,
        language: true,
      } as any,
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
        nameVi: true,
        nameEn: true,
        slug: true,
        language: true,
        description: true,
        _count: {
          select: {
            stories: true,
          },
        },
      } as any,
      orderBy: {
        name: 'asc',
      },
    });

    return {
      data: (categories as any[]).map((item) => ({
        id: item.id,
        name: item.name,
        nameVi: item.nameVi,
        nameEn: item.nameEn,
        slug: item.slug,
        language: item.language,
        description: item.description,
        storiesCount: item._count ? item._count.stories : 0,
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

    if (!existing) {
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

    await this.invalidateExploreCache();

    return this.serializeStory(updated);
  }

  async deleteStory(id: string) {
    const existing = await this.prisma.story.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!existing) {
      throw new NotFoundException('Story not found');
    }

    if (existing.deletedAt) {
      return { message: 'Story is already deleted' };
    }

    // Soft delete the story
    await this.prisma.story.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.invalidateExploreCache();

    return { message: 'Story deleted successfully' };
  }

  async giftCredits(storyId: string, userId: string, amount: number, message?: string) {
    // Validate amount
    if (amount < 10) {
      throw new BadRequestException('Minimum gift amount is 10 credits');
    }

    // Get user and check balance
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.credits < amount) {
      throw new BadRequestException('Insufficient credits');
    }

    // Get story
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, authorId: true, deletedAt: true, title: true },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (!story.authorId) {
      throw new BadRequestException('Story has no author');
    }

    // Deduct credits from user and create transaction record
    await this.prisma.$transaction([
      // Deduct credits from user
      this.prisma.user.update({
        where: { id: userId },
        data: { credits: { decrement: amount } },
      }),
      // Create credit transaction record
      this.prisma.creditTransaction.create({
        data: {
          userId,
          type: 'spend',
          amount: -amount,
          balanceBefore: user.credits,
          balanceAfter: user.credits - amount,
          referenceId: storyId,
          description: `Gift ${amount} credits to story: ${story.title}${message ? ` - ${message}` : ''}`,
        },
      }),
    ]);

    return {
      ok: true,
      message: 'Gift sent successfully',
      amount,
    };
  }
}
