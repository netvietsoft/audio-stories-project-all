import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ChapterCommentScope, CreateChapterCommentDto } from './dto/create-chapter-comment.dto';
import { ListChapterCommentsDto } from './dto/list-chapter-comments.dto';

@Injectable()
export class ChapterCommentsService {
  constructor(private readonly prisma: PrismaService) { }

  private serializeComment(comment: any) {
    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      likesCount: comment.likesCount,
      paragraphIndex: comment.timestampSeconds,
      user: {
        id: comment.user?.id,
        displayName: comment.user?.displayName || 'Độc giả',
        avatarUrl: comment.user?.avatarUrl || null,
      },
      repliesCount: comment._count?.replies ?? 0,
    };
  }

  private buildScopeFilter(query: ListChapterCommentsDto) {
    if (query.scope === ChapterCommentScope.PARAGRAPH) {
      return {
        timestampSeconds: query.paragraphIndex ?? 0,
      } satisfies Prisma.ChapterCommentWhereInput;
    }

    return {
      timestampSeconds: null,
    } satisfies Prisma.ChapterCommentWhereInput;
  }

  async list(chapterId: string, query: ListChapterCommentsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const where: Prisma.ChapterCommentWhereInput = {
      chapterId,
      parentId: null,
      isHidden: false,
      ...this.buildScopeFilter(query),
    };

    const [total, rows] = await Promise.all([
      this.prisma.chapterComment.count({ where }),
      this.prisma.chapterComment.findMany({
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
          _count: {
            select: {
              replies: true,
            },
          },
        },
      }),
    ]);

    return {
      data: {
        comments: rows.map((row) => this.serializeComment(row)),
      },
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async create(userId: string, chapterId: string, dto: CreateChapterCommentDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        storyId: true,
        deletedAt: true,
      },
    });

    if (!chapter || chapter.deletedAt) {
      throw new NotFoundException('Chapter not found');
    }

    if (dto.parentId) {
      const parent = await this.prisma.chapterComment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, chapterId: true },
      });

      if (!parent || parent.chapterId !== chapterId) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    const isParagraphScope = dto.scope === ChapterCommentScope.PARAGRAPH;
    if (!chapter.storyId) {
      throw new NotFoundException('Chapter does not belong to a story');
    }

    const created = await this.prisma.chapterComment.create({
      data: {
        userId,
        chapterId,
        storyId: chapter.storyId,
        parentId: dto.parentId,
        content: dto.content.trim(),
        timestampSeconds: isParagraphScope ? (dto.paragraphIndex ?? 0) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    return {
      data: this.serializeComment(created),
    };
  }
}
