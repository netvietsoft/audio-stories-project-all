import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';
import { CreateMusicCommentDto } from './dto/create-music-comment.dto';
import { ListMusicCommentsDto } from './dto/list-music-comments.dto';
import { UpdateMusicCommentDto } from './dto/update-music-comment.dto';

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

  private serializeComment(row: {
    id: string;
    musicId: string;
    userId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }) {
    return {
      id: row.id,
      musicId: row.musicId,
      userId: row.userId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.user.id,
        displayName: row.user.displayName,
        avatarUrl: row.user.avatarUrl,
      },
    };
  }

  async list(musicId: string, query: ListMusicCommentsDto) {
    await this.ensureMusic(musicId);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 20), 100);

    const where = { musicId };

    const [total, rows] = await Promise.all([
      this.prisma.musicComment.count({ where }),
      this.prisma.musicComment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      data: rows.map((row) => this.serializeComment(row)),
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async create(userId: string, musicId: string, dto: CreateMusicCommentDto) {
    await this.ensureMusic(musicId);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.musicComment.create({
        data: {
          userId,
          musicId,
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

  async update(userId: string, isAdmin: boolean, commentId: string, dto: UpdateMusicCommentDto) {
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

    if (!isAdmin && existing.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comment.');
    }

    const updated = await this.prisma.musicComment.update({
      where: { id: commentId },
      data: {
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
      data: this.serializeComment(updated),
    };
  }

  async remove(userId: string, isAdmin: boolean, commentId: string) {
    const existing = await this.prisma.musicComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        musicId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Comment not found.');
    }

    if (!isAdmin && existing.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comment.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.musicComment.delete({
        where: { id: commentId },
      });

      const music = await tx.music.findUnique({
        where: { id: existing.musicId },
        select: { commentCount: true },
      });

      await tx.music.update({
        where: { id: existing.musicId },
        data: {
          commentCount: Math.max(0, (music?.commentCount || 0) - 1),
        },
      });
    });

    return { ok: true };
  }
}
