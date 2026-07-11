import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommentReactionType, Prisma } from '@prisma/client';

import { GeoService } from '@/common/geo/geo.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ChapterCommentScope, CreateChapterCommentDto } from './dto/create-chapter-comment.dto';
import { ChapterCommentSortType, ListChapterCommentsDto } from './dto/list-chapter-comments.dto';
import { ListRepliesDto } from './dto/list-replies.dto';
import { ListCommentReportsDto } from './dto/list-comment-reports.dto';
import { UpdateCommentReportDto } from './dto/update-comment-report.dto';

@Injectable()
export class ChapterCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
  ) {}

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
      paragraphAnchor: comment.paragraphAnchor ?? null,
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
    if (query.allParagraphs) {
      return {
        timestampSeconds: { not: null },
      } satisfies Prisma.ChapterCommentWhereInput;
    }

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

    const allParagraphs = query.allParagraphs === true;
    const queryTake = allParagraphs ? 1000 : isHelpfulMode ? Math.min(limit, 10) : limit;
    const querySkip = allParagraphs || isHelpfulMode ? 0 : (page - 1) * limit;

    const [total, rows] = await Promise.all([
      this.prisma.chapterComment.count({ where }),
      this.prisma.chapterComment.findMany({
        where,
        orderBy,
        skip: querySkip,
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

  async create(userId: string, chapterId: string, dto: CreateChapterCommentDto, ip?: string) {
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
        paragraphAnchor: isParagraphScope ? (dto.paragraphAnchor ?? null) : null,
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

    void this.geo.record(chapter.storyId, ip, 'comment', 1);

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

  async reportComment(userId: string, commentId: string, reason: string) {
    const comment = await this.prisma.chapterComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, isHidden: true },
    });

    if (!comment || comment.isHidden) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId === userId) {
      throw new BadRequestException('You cannot report your own comment');
    }

    const normalizedReason = reason.trim();
    const existing = await this.prisma.commentReport.findFirst({
      where: {
        userId,
        commentId,
        status: { in: ['pending', 'reviewed'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    if (existing) {
      return {
        ok: true,
        alreadyReported: true,
        data: existing,
      };
    }

    const report = await this.prisma.commentReport.create({
      data: {
        userId,
        commentId,
        reason: normalizedReason,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      ok: true,
      data: report,
    };
  }

  async listReports(query: ListCommentReportsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const search = query.search?.trim();

    const where: Prisma.CommentReportWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { reason: { contains: search } },
              { adminNote: { contains: search } },
              { comment: { content: { contains: search } } },
              { comment: { user: { displayName: { contains: search } } } },
              { comment: { user: { email: { contains: search } } } },
              { comment: { story: { title: { contains: search } } } },
              { comment: { chapter: { title: { contains: search } } } },
              { user: { displayName: { contains: search } } },
              { user: { email: { contains: search } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.commentReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          comment: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              isHidden: true,
              timestampSeconds: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              story: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                },
              },
              chapter: {
                select: {
                  id: true,
                  title: true,
                  chapterNumber: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.commentReport.count({ where }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getReportStats() {
    const [totalReports, pendingReports, reviewedReports, resolvedReports, dismissedReports] =
      await Promise.all([
        this.prisma.commentReport.count(),
        this.prisma.commentReport.count({ where: { status: 'pending' } }),
        this.prisma.commentReport.count({ where: { status: 'reviewed' } }),
        this.prisma.commentReport.count({ where: { status: 'resolved' } }),
        this.prisma.commentReport.count({ where: { status: 'dismissed' } }),
      ]);

    return {
      totalReports,
      pendingReports,
      reviewedReports,
      resolvedReports,
      dismissedReports,
    };
  }

  async updateReport(reportId: string, dto: UpdateCommentReportDto) {
    if (dto.status === undefined && dto.adminNote === undefined && dto.hideComment === undefined) {
      throw new BadRequestException('Nothing to update');
    }

    const report = await this.prisma.commentReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        commentId: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const tx: Prisma.PrismaPromise<any>[] = [];

    if (dto.hideComment !== undefined) {
      tx.push(
        this.prisma.chapterComment.update({
          where: { id: report.commentId },
          data: { isHidden: dto.hideComment },
        }),
      );
    }

    tx.push(
      this.prisma.commentReport.update({
        where: { id: report.id },
        data: {
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.adminNote !== undefined ? { adminNote: dto.adminNote.trim() || null } : {}),
        },
      }),
    );

    await this.prisma.$transaction(tx);

    return this.prisma.commentReport.findUnique({
      where: { id: reportId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        comment: {
          select: {
            id: true,
            content: true,
            isHidden: true,
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
            story: {
              select: {
                id: true,
                title: true,
              },
            },
            chapter: {
              select: {
                id: true,
                title: true,
                chapterNumber: true,
              },
            },
          },
        },
      },
    });
  }

  async getCommentCounts(chapterId: string) {
    const grouped = await this.prisma.chapterComment.groupBy({
      by: ['timestampSeconds'],
      where: {
        chapterId,
        parentId: null,
        isHidden: false,
        timestampSeconds: { not: null },
      },
      _count: {
        _all: true,
      },
    });

    const counts: Record<number, number> = {};
    for (const row of grouped) {
      if (row.timestampSeconds !== null) {
        counts[row.timestampSeconds] = row._count._all;
      }
    }

    return {
      data: counts,
    };
  }
}

