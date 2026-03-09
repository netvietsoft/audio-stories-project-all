import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsDto, ReviewSortType } from './dto/list-reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeReview(row: any) {
    return {
      id: row.id,
      rating: row.rating,
      content: row.content,
      likesCount: row.likesCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.user?.id,
        displayName: row.user?.displayName || 'Doc gia',
        avatarUrl: row.user?.avatarUrl || null,
      },
    };
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

  private async syncStoryRating(storyId: string, tx: Prisma.TransactionClient) {
    const aggregate = await tx.review.aggregate({
      where: { storyId },
      _avg: { rating: true },
      _count: { _all: true },
    });

    const average = aggregate._avg.rating || 0;
    const count = aggregate._count._all || 0;

    await tx.story.update({
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

  async listReviews(storyIdOrSlug: string, query: ListReviewsDto) {
    const storyId = await this.resolveStoryId(storyIdOrSlug);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 30);

    const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
      query.sort === ReviewSortType.HIGHEST
        ? [{ rating: 'desc' }, { createdAt: 'desc' }]
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
        },
      }),
    ]);

    return {
      data: rows.map((row) => this.normalizeReview(row)),
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async upsertReview(storyIdOrSlug: string, userId: string, dto: CreateReviewDto) {
    const storyId = await this.resolveStoryId(storyIdOrSlug);

    if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.upsert({
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

      await this.syncStoryRating(storyId, tx);
      return review;
    });

    return {
      data: this.normalizeReview(result),
    };
  }
}
