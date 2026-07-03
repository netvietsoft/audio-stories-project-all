import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class MusicCommentService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureMusic(musicId: string) {
    const music = await this.prisma.music.findUnique({
      where: { id: musicId },
      select: { id: true },
    });

    if (!music) {
      throw new NotFoundException('Music not found.');
    }
  }

  private serializeComment(row: any) {
    return {
      id: row.id,
      musicId: row.musicId,
      userId: row.userId,
      parentId: row.parentId || null,
      content: row.content,
      likeCount: row.likeCount || 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.user.id,
        displayName: row.user.displayName,
        avatarUrl: row.user.avatarUrl,
      },
      children: Array.isArray(row.children)
        ? row.children.map((child: any) => this.serializeComment(child))
        : [],
    };
  }

  async listComments(
    musicId: string,
    query: { page: number; limit: number; sort: 'newest' | 'oldest' },
  ) {
    await this.ensureMusic(musicId);

    const page = query.page;
    const limit = query.limit;
    const orderDir = query.sort === 'oldest' ? ('asc' as const) : ('desc' as const);

    const where = { musicId, parentId: null };

    const [total, rows] = await Promise.all([
      this.prisma.musicComment.count({ where }),
      this.prisma.musicComment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: orderDir },
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
            take: 50,
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
      data: rows.map((row) => this.serializeComment(row)),
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createComment(userId: string, musicId: string, content: string) {
    await this.ensureMusic(musicId);

    const trimmed = (content || '').trim();
    if (!trimmed) {
      throw new ForbiddenException('Comment content required.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.musicComment.create({
        data: {
          userId,
          musicId,
          content: trimmed,
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

      await tx.music.update({
        where: { id: musicId },
        data: {
          commentCount: { increment: 1 },
        },
      });

      return row;
    });

    return {
      data: this.serializeComment(created),
    };
  }

  async replyComment(userId: string, parentId: string, content: string) {
    const parent = await this.prisma.musicComment.findUnique({
      where: { id: parentId },
      select: { id: true, musicId: true, parentId: true },
    });

    if (!parent) {
      throw new NotFoundException('Comment not found.');
    }

    // Only allow 1-level nesting: if parent is already a reply, attach to the root
    const resolvedParentId = parent.parentId || parent.id;
    const trimmed = (content || '').trim();
    if (!trimmed) {
      throw new ForbiddenException('Reply content required.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.musicComment.create({
        data: {
          userId,
          musicId: parent.musicId,
          parentId: resolvedParentId,
          content: trimmed,
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

      await tx.music.update({
        where: { id: parent.musicId },
        data: {
          commentCount: { increment: 1 },
        },
      });

      return row;
    });

    return {
      data: this.serializeComment(created),
    };
  }

  async likeComment(userId: string, commentId: string) {
    const comment = await this.prisma.musicComment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    const existing = await this.prisma.musicCommentLike.findUnique({
      where: {
        userId_commentId: { userId, commentId },
      },
    });

    if (existing) return { data: { liked: true } };

    await this.prisma.$transaction(async (tx) => {
      await tx.musicCommentLike.create({
        data: { userId, commentId },
      });
      await tx.musicComment.update({
        where: { id: commentId },
        data: { likeCount: { increment: 1 } },
      });
    });

    return { data: { liked: true } };
  }

  async unlikeComment(userId: string, commentId: string) {
    const comment = await this.prisma.musicComment.findUnique({
      where: { id: commentId },
      select: { id: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    const existing = await this.prisma.musicCommentLike.findUnique({
      where: {
        userId_commentId: { userId, commentId },
      },
    });

    if (!existing) return { data: { liked: false } };

    await this.prisma.$transaction(async (tx) => {
      await tx.musicCommentLike.delete({
        where: { userId_commentId: { userId, commentId } },
      });
      await tx.musicComment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
      });
    });

    return { data: { liked: false } };
  }

  async updateComment(userId: string, commentId: string, content: string) {
    const existing = await this.prisma.musicComment.findUnique({
      where: { id: commentId },
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

    if (!existing) {
      throw new NotFoundException('Comment not found.');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comment.');
    }

    const trimmed = (content || '').trim();
    if (!trimmed) {
      throw new ForbiddenException('Comment content required.');
    }

    const updated = await this.prisma.musicComment.update({
      where: { id: commentId },
      data: {
        content: trimmed,
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
      data: this.serializeComment(updated),
    };
  }

  async deleteComment(userId: string, commentId: string) {
    const existing = await this.prisma.musicComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        musicId: true,
        _count: { select: { children: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found.');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comment.');
    }

    const childCount = existing._count?.children || 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.musicComment.delete({
        where: { id: commentId },
      });

      const music = await tx.music.findUnique({
        where: { id: existing.musicId },
        select: { commentCount: true },
      });

      // Decrement by 1 (the comment itself) + number of children that cascade-deleted
      const decrement = 1 + childCount;
      await tx.music.update({
        where: { id: existing.musicId },
        data: {
          commentCount: Math.max(0, (music?.commentCount || 0) - decrement),
        },
      });
    });

    return { ok: true };
  }
}
