import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { GeoService } from '@/common/geo/geo.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateReviewReplyDto } from './dto/create-review-reply.dto';
import { ListReviewRepliesDto } from './dto/list-review-replies.dto';
import { ListReviewsDto, ReviewSortType } from './dto/list-reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
  ) {}

  private normalizeReview(row: any, currentUserId?: string) {
    const likedByMe = currentUserId
      ? (row.reviewLikes || []).some((item: { userId: string }) => item.userId === currentUserId)
      : false;
    const helpfulByMe = currentUserId
      ? (row.reviewHelpfuls || []).some((item: { userId: string }) => item.userId === currentUserId)
      : false;

    return {
      id: row.id,
      rating: row.rating,
      content: row.content,
      likesCount: row.likesCount,
      helpfulCount: row.helpfulCount || 0,
      likedByMe,
      helpfulByMe,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.user?.id,
        displayName: row.user?.displayName || 'Độc giả',
        avatarUrl: row.user?.avatarUrl || null,
      },
      repliesCount: row._count?.replies || 0,
      replies: (row.replies || []).map((reply: any) => ({
        id: reply.id,
        parentId: reply.parentId,
        content: reply.content,
        createdAt: reply.createdAt,
        user: {
          id: reply.user?.id,
          displayName: reply.user?.displayName || 'Độc giả',
          avatarUrl: reply.user?.avatarUrl || null,
        },
      })),
    };
  }

  private async ensureReview(reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }
  }

  private async resolveStoryId(storyIdOrSlug: string) {
    const story = await this.prisma.story.findFirst({
      where: {
        OR: [{ id: storyIdOrSlug }, { slug: storyIdOrSlug }],
      },
      select: { id: true, deletedAt: true },
    });

    if (!story || story.deletedAt) {
      throw new NotFoundException('Story not found');
    }

    return story.id;
  }

  private async syncStoryRating(storyId: string) {
    const aggregate = await this.prisma.review.aggregate({
      where: { storyId },
      _avg: { rating: true },
      _count: { _all: true },
    });

    const average = aggregate._avg.rating || 0;
    const count = aggregate._count._all || 0;

    await this.prisma.story.update({
      where: { id: storyId },
      data: {
        averageRating: new Prisma.Decimal(average.toFixed(2)),
        ratingCount: count,
      },
    });
  }

  async getRatingStats(storyIdOrSlug: string) {
    const storyId = await this.resolveStoryId(storyIdOrSlug);

    const [summary, grouped] = await Promise.all([
      this.prisma.review.aggregate({
        where: { storyId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { storyId },
        _count: { _all: true },
      }),
    ]);

    const distribution = [5, 4, 3, 2, 1].map((rating) => {
      const found = grouped.find((item) => item.rating === rating);
      return {
        rating,
        count: found?._count._all || 0,
      };
    });

    return {
      data: {
        averageRating: Number((summary._avg.rating || 0).toFixed(2)),
        ratingCount: summary._count._all || 0,
        distribution,
      },
    };
  }

  async listReviews(storyIdOrSlug: string, query: ListReviewsDto, currentUserId?: string) {
    const storyId = await this.resolveStoryId(storyIdOrSlug);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 30);

    const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
      query.sort === ReviewSortType.HIGHEST
        ? [{ rating: 'desc' }, { createdAt: 'desc' }]
        : query.sort === ReviewSortType.HELPFUL
          ? [{ helpfulCount: 'desc' }, { likesCount: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];

    const where: Prisma.ReviewWhereInput = { storyId };

    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          reviewLikes: {
            select: {
              userId: true,
            },
          },
          reviewHelpfuls: {
            select: {
              userId: true,
            },
          },
          replies: {
            where: { parentId: null },
            orderBy: { createdAt: 'desc' },
            take: 2,
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((row) => this.normalizeReview(row, currentUserId)),
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async upsertReview(storyIdOrSlug: string, userId: string, dto: CreateReviewDto, ip?: string) {
    const storyId = await this.resolveStoryId(storyIdOrSlug);

    if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const result = await this.prisma.review.upsert({
      where: {
        userId_storyId: {
          userId,
          storyId,
        },
      },
      update: {
        rating: dto.rating,
        content: dto.content?.trim() || null,
      },
      create: {
        userId,
        storyId,
        rating: dto.rating,
        content: dto.content?.trim() || null,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    void this.geo.record(storyId, ip, 'rating', 1);

    await this.syncStoryRating(storyId);

    return {
      data: this.normalizeReview(result, userId),
    };
  }

  async toggleLike(reviewId: string, userId: string) {
    await this.ensureReview(reviewId);

    const existing = await this.prisma.reviewLike.findUnique({
      where: {
        userId_reviewId: {
          userId,
          reviewId,
        },
      },
    });

    if (existing) {
      await this.prisma.reviewLike.delete({
        where: {
          userId_reviewId: {
            userId,
            reviewId,
          },
        },
      });
    } else {
      await this.prisma.reviewLike.create({
        data: {
          userId,
          reviewId,
        },
      });
    }

    const likesCount = await this.prisma.reviewLike.count({ where: { reviewId } });
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { likesCount },
    });

    return {
      data: {
        likedByMe: !existing,
        likesCount,
      },
    };
  }

  async toggleHelpful(reviewId: string, userId: string) {
    await this.ensureReview(reviewId);

    const existing = await this.prisma.reviewHelpful.findUnique({
      where: {
        userId_reviewId: {
          userId,
          reviewId,
        },
      },
    });

    if (existing) {
      await this.prisma.reviewHelpful.delete({
        where: {
          userId_reviewId: {
            userId,
            reviewId,
          },
        },
      });
    } else {
      await this.prisma.reviewHelpful.create({
        data: {
          userId,
          reviewId,
        },
      });
    }

    const helpfulCount = await this.prisma.reviewHelpful.count({ where: { reviewId } });
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount },
    });

    return {
      data: {
        helpfulByMe: !existing,
        helpfulCount,
      },
    };
  }

  async listReplies(reviewId: string, query: ListReviewRepliesDto) {
    await this.ensureReview(reviewId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);

    const where: Prisma.ReviewReplyWhereInput = {
      reviewId,
      parentId: null,
    };

    const [total, rows] = await Promise.all([
      this.prisma.reviewReply.count({ where }),
      this.prisma.reviewReply.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          children: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        parentId: row.parentId,
        content: row.content,
        createdAt: row.createdAt,
        user: {
          id: row.user.id,
          displayName: row.user.displayName || 'Độc giả',
          avatarUrl: row.user.avatarUrl || null,
        },
        children: row.children.map((child) => ({
          id: child.id,
          parentId: child.parentId,
          content: child.content,
          createdAt: child.createdAt,
          user: {
            id: child.user.id,
            displayName: child.user.displayName || 'Độc giả',
            avatarUrl: child.user.avatarUrl || null,
          },
        })),
      })),
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createReply(reviewId: string, userId: string, dto: CreateReviewReplyDto) {
    await this.ensureReview(reviewId);

    if (dto.parentId) {
      const parent = await this.prisma.reviewReply.findUnique({
        where: { id: dto.parentId },
        select: { id: true, reviewId: true },
      });

      if (!parent || parent.reviewId !== reviewId) {
        throw new NotFoundException('Parent reply not found');
      }
    }

    const created = await this.prisma.reviewReply.create({
      data: {
        reviewId,
        userId,
        parentId: dto.parentId,
        content: dto.content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      data: {
        id: created.id,
        parentId: created.parentId,
        content: created.content,
        createdAt: created.createdAt,
        user: {
          id: created.user.id,
          displayName: created.user.displayName || 'Độc giả',
          avatarUrl: created.user.avatarUrl || null,
        },
      },
    };
  }
}
