import { Injectable, NotFoundException } from '@nestjs/common';
import { CommentReactionType, Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ChapterCommentScope, CreateChapterCommentDto } from './dto/create-chapter-comment.dto';
import { ChapterCommentSortType, ListChapterCommentsDto } from './dto/list-chapter-comments.dto';
import { ListRepliesDto } from './dto/list-replies.dto';

@Injectable()
export class ChapterCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getReactionMap(commentIds: string[]) {
    if (!commentIds.length) {
      return new Map<string, Record<CommentReactionType, number>>();
    }

    const grouped = await this.prisma.commentReaction.groupBy({
      by: ['commentId', 'type'],
      where: {
        commentId: { in: commentIds },
      },
      _count: {
        _all: true,
      },
    });

    const map = new Map<string, Record<CommentReactionType, number>>();
    for (const row of grouped) {
      const current =
        map.get(row.commentId) ||
        ({
          helpful: 0,
          like: 0,
          love: 0,
        } satisfies Record<CommentReactionType, number>);
      current[row.type] = row._count._all;
      map.set(row.commentId, current);
    }

    return map;
  }

  private serializeComment(comment: any, reactionMap: Map<string, Record<CommentReactionType, number>>) {
    const reactions =
      reactionMap.get(comment.id) ||
      ({
        helpful: 0,
        like: 0,
        love: 0,
      } satisfies Record<CommentReactionType, number>);

    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      likesCount: comment.likesCount,
      paragraphIndex: comment.timestampSeconds,
      user: {
        id: comment.user?.id,
        displayName: comment.user?.displayName || 'Doc gia',
        avatarUrl: comment.user?.avatarUrl || null,
      },
      reactions,
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

    const sort = query.sort ?? ChapterCommentSortType.NEWEST;
    const isHelpfulMode = sort === ChapterCommentSortType.HELPFUL;

    const orderBy: Prisma.ChapterCommentOrderByWithRelationInput[] =
      sort === ChapterCommentSortType.ALL
        ? [{ createdAt: 'asc' }]
        : sort === ChapterCommentSortType.HELPFUL
          ? [{ likesCount: 'desc' }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }];

    const queryTake = isHelpfulMode ? Math.min(limit, 10) : limit;

    const [total, rows] = await Promise.all([
      this.prisma.chapterComment.count({ where }),
      this.prisma.chapterComment.findMany({
        where,
        orderBy,
        skip: isHelpfulMode ? 0 : (page - 1) * limit,
        take: queryTake,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          replies: {
            where: { isHidden: false },
            orderBy: { createdAt: 'asc' },
            take: 3,
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
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
      }),
    ]);

    const allCommentIds = rows.flatMap((row) => [row.id, ...row.replies.map((reply) => reply.id)]);
    const reactionMap = await this.getReactionMap(allCommentIds);

    const comments = rows.map((row) => ({
      ...this.serializeComment(row, reactionMap),
      replies: row.replies.map((reply) => this.serializeComment(reply, reactionMap)),
    }));

    return {
      data: {
        comments,
      },
      meta: {
        total: isHelpfulMode ? Math.min(total, 10) : total,
        page,
        lastPage: isHelpfulMode ? 1 : Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async listReplies(commentId: string, query: ListRepliesDto) {
    const parent = await this.prisma.chapterComment.findUnique({
      where: { id: commentId },
      select: { id: true, isHidden: true },
    });

    if (!parent || parent.isHidden) {
      throw new NotFoundException('Comment not found');
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);

    const where: Prisma.ChapterCommentWhereInput = {
      parentId: commentId,
      isHidden: false,
    };

    const [total, rows] = await Promise.all([
      this.prisma.chapterComment.count({ where }),
      this.prisma.chapterComment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
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

    const reactionMap = await this.getReactionMap(rows.map((row) => row.id));

    return {
      data: {
        replies: rows.map((row) => this.serializeComment(row, reactionMap)),
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

    if (!chapter.storyId) {
      throw new NotFoundException('Chapter is not assigned to any story');
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

    const reactionMap = await this.getReactionMap([created.id]);

    return {
      data: this.serializeComment(created, reactionMap),
    };
  }

  async toggleReaction(userId: string, commentId: string, type: CommentReactionType) {
    const comment = await this.prisma.chapterComment.findUnique({
      where: { id: commentId },
      select: { id: true, isHidden: true },
    });

    if (!comment || comment.isHidden) {
      throw new NotFoundException('Comment not found');
    }

    const existing = await this.prisma.commentReaction.findFirst({
      where: {
        userId,
        commentId,
        type,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      await this.prisma.commentReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.commentReaction.create({
        data: {
          userId,
          commentId,
          type,
        },
      });
    }

    const reactionMap = await this.getReactionMap([commentId]);
    const reactions =
      reactionMap.get(commentId) ||
      ({
        helpful: 0,
        like: 0,
        love: 0,
      } satisfies Record<CommentReactionType, number>);

    const helpfulCount = reactions.helpful || 0;
    await this.prisma.chapterComment.update({
      where: { id: commentId },
      data: { likesCount: helpfulCount },
    });

    return {
      data: {
        commentId,
        toggledOn: !existing,
        type,
        reactions,
      },
    };
  }
}
