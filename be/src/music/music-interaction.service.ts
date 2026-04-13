import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ListMusicFavoritesDto } from './dto/list-music-favorites.dto';
import { ListMusicHistoryDto } from './dto/list-music-history.dto';

@Injectable()
export class MusicInteractionService {
  constructor(private readonly prisma: PrismaService) {}

  private parseTags(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  private serializeMusic(row: {
    id: string;
    title: string;
    artist: string;
    description: string | null;
    tags: Prisma.JsonValue | null;
    thumbnailUrl: string | null;
    audioUrl: string;
    audioDuration: number | null;
    contentType: string;
    playlistTrackIds: Prisma.JsonValue | null;
    playCount: number;
    likeCount: number;
    commentCount: number;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...row,
      tags: this.parseTags(row.tags),
      playlistTrackIds: Array.isArray(row.playlistTrackIds)
        ? row.playlistTrackIds
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        : [],
    };
  }

  private async ensureMusic(musicId: string) {
    const music = await this.prisma.music.findUnique({
      where: { id: musicId },
      select: { id: true },
    });

    if (!music) {
      throw new NotFoundException('Music not found.');
    }
  }

  async getLikeStatus(userId: string, musicId: string) {
    await this.ensureMusic(musicId);

    const row = await this.prisma.musicLike.findUnique({
      where: {
        userId_musicId: {
          userId,
          musicId,
        },
      },
      select: { id: true },
    });

    return {
      data: {
        musicId,
        liked: Boolean(row),
      },
    };
  }

  async like(userId: string, musicId: string) {
    await this.ensureMusic(musicId);

    const existing = await this.prisma.musicLike.findUnique({
      where: {
        userId_musicId: {
          userId,
          musicId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.$transaction([
        this.prisma.musicLike.create({
          data: {
            userId,
            musicId,
          },
        }),
        this.prisma.music.update({
          where: { id: musicId },
          data: {
            likeCount: { increment: 1 },
          },
        }),
      ]);
    }

    const music = await this.prisma.music.findUnique({
      where: { id: musicId },
      select: { likeCount: true },
    });

    return {
      data: {
        musicId,
        liked: true,
        likeCount: music?.likeCount || 0,
      },
    };
  }

  async unlike(userId: string, musicId: string) {
    await this.ensureMusic(musicId);

    const existing = await this.prisma.musicLike.findUnique({
      where: {
        userId_musicId: {
          userId,
          musicId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.musicLike.delete({
          where: {
            userId_musicId: {
              userId,
              musicId,
            },
          },
        });

        const current = await tx.music.findUnique({
          where: { id: musicId },
          select: { likeCount: true },
        });

        await tx.music.update({
          where: { id: musicId },
          data: {
            likeCount: Math.max(0, (current?.likeCount || 0) - 1),
          },
        });
      });
    }

    const music = await this.prisma.music.findUnique({
      where: { id: musicId },
      select: { likeCount: true },
    });

    return {
      data: {
        musicId,
        liked: false,
        likeCount: music?.likeCount || 0,
      },
    };
  }

  async addHistory(userId: string, musicId: string) {
    await this.ensureMusic(musicId);

    const row = await this.prisma.musicHistory.create({
      data: {
        userId,
        musicId,
      },
    });

    return {
      data: row,
    };
  }

  async listHistory(userId: string, query: ListMusicHistoryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 20), 100);

    const where: Prisma.MusicHistoryWhereInput = { userId };

    const [total, rows] = await Promise.all([
      this.prisma.musicHistory.count({ where }),
      this.prisma.musicHistory.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { listenedAt: 'desc' },
        include: {
          music: true,
        },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        progressSeconds: row.progressSeconds || 0,
        listenedAt: row.listenedAt,
        music: this.serializeMusic(row.music),
      })),
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async deleteHistoryEntry(userId: string, entryId: string) {
    const entry = await this.prisma.musicHistory.findUnique({
      where: { id: entryId },
      select: { id: true, userId: true },
    });

    if (!entry || entry.userId !== userId) {
      throw new NotFoundException('History entry not found.');
    }

    await this.prisma.musicHistory.delete({
      where: { id: entryId },
    });

    return { ok: true };
  }

  async clearHistory(userId: string) {
    await this.prisma.musicHistory.deleteMany({
      where: { userId },
    });

    return { ok: true };
  }

  async listFavorites(userId: string, query: ListMusicFavoritesDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 20), 100);

    const where: Prisma.MusicLikeWhereInput = { userId };

    const [total, rows] = await Promise.all([
      this.prisma.musicLike.count({ where }),
      this.prisma.musicLike.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          music: true,
        },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        likedAt: row.createdAt,
        music: this.serializeMusic(row.music),
      })),
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}
