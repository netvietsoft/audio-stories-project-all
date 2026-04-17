import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MusicAccessType, MusicContentType, Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ListMusicFavoritesDto } from './dto/list-music-favorites.dto';
import { ListMusicHistoryDto } from './dto/list-music-history.dto';

@Injectable()
export class MusicInteractionService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeProgressSeconds(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
  }

  private parsePlaylistTrackIds(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  private parseTags(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  private serializeMusic(row: {
    id: string;
    slug: string;
    title: string;
    artist: string;
    description: string | null;
    tags: Prisma.JsonValue | null;
    thumbnailUrl: string | null;
    audioUrl: string;
    audioDuration: number | null;
    contentType: MusicContentType;
    accessType: MusicAccessType;
    unlockPrice: number;
    introEnabled: boolean;
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
      playlistTrackIds: this.parsePlaylistTrackIds(row.playlistTrackIds),
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

  private async getPlayableState(userId: string, musicId: string) {
    const music = await this.prisma.music.findUnique({
      where: { id: musicId },
      select: {
        id: true,
        title: true,
        contentType: true,
        accessType: true,
        unlockPrice: true,
        playlistTrackIds: true,
        isPublic: true,
      },
    });

    if (!music || !music.isPublic) {
      throw new NotFoundException('Music not found.');
    }

    if (music.accessType === MusicAccessType.free || music.unlockPrice <= 0) {
      return {
        music,
        unlocked: true,
        unlockSource: 'free' as const,
      };
    }

    const directUnlock = await this.prisma.musicUnlock.findUnique({
      where: {
        userId_musicId: {
          userId,
          musicId: music.id,
        },
      },
      select: {
        id: true,
        sourceType: true,
      },
    });

    if (directUnlock) {
      return {
        music,
        unlocked: true,
        unlockSource: directUnlock.sourceType,
      };
    }

    if (music.contentType !== MusicContentType.playlist) {
      return {
        music,
        unlocked: false,
        unlockSource: null,
      };
    }

    const playlistTrackIds = this.parsePlaylistTrackIds(music.playlistTrackIds);
    if (!playlistTrackIds.length) {
      return {
        music,
        unlocked: true,
        unlockSource: 'playlist' as const,
      };
    }

    const [tracks, unlocks] = await Promise.all([
      this.prisma.music.findMany({
        where: {
          id: { in: playlistTrackIds },
          isPublic: true,
          contentType: { in: [MusicContentType.single, MusicContentType.podcast] },
        },
        select: {
          id: true,
          accessType: true,
          unlockPrice: true,
        },
      }),
      this.prisma.musicUnlock.findMany({
        where: {
          userId,
          musicId: { in: playlistTrackIds },
        },
        select: { musicId: true },
      }),
    ]);

    const unlockedTrackIds = new Set(unlocks.map((item) => item.musicId));
    const allTracksUnlocked = tracks.every((track) => {
      if (track.accessType === MusicAccessType.free || track.unlockPrice <= 0) {
        return true;
      }

      return unlockedTrackIds.has(track.id);
    });

    return {
      music,
      unlocked: allTracksUnlocked,
      unlockSource: allTracksUnlocked ? ('playlist' as const) : null,
    };
  }

  async getAccessStatus(userId: string, musicId: string) {
    const state = await this.getPlayableState(userId, musicId);

    return {
      data: {
        musicId: state.music.id,
        contentType: state.music.contentType,
        accessType: state.music.accessType,
        unlockPrice: state.music.unlockPrice,
        unlocked: state.unlocked,
        canPlay: state.unlocked,
        unlockSource: state.unlockSource,
      },
    };
  }

  async unlockMusic(userId: string, musicId: string) {
    const state = await this.getPlayableState(userId, musicId);

    if (state.unlocked) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      return {
        data: {
          musicId: state.music.id,
          contentType: state.music.contentType,
          unlocked: true,
          unlockPrice: state.music.unlockPrice,
          chargedCredits: 0,
          balance: user?.credits ?? 0,
          unlockSource: state.unlockSource,
        },
      };
    }

    if (state.music.accessType !== MusicAccessType.vip || state.music.unlockPrice <= 0) {
      throw new BadRequestException('This track does not require paid unlock.');
    }

    const chargedCredits = state.music.unlockPrice;

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, credits: true },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      if (user.credits < chargedCredits) {
        throw new BadRequestException('Insufficient credits.');
      }

      const targetTrackIds = state.music.contentType === MusicContentType.playlist
        ? this.parsePlaylistTrackIds(state.music.playlistTrackIds)
        : [];

      const unlockTargetIds = Array.from(new Set([state.music.id, ...targetTrackIds]));

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          credits: { decrement: chargedCredits },
        },
        select: { credits: true },
      });

      await Promise.all(
        unlockTargetIds.map((targetId) =>
          tx.musicUnlock.upsert({
            where: {
              userId_musicId: {
                userId,
                musicId: targetId,
              },
            },
            update: {
              sourceType: state.music.contentType === MusicContentType.playlist ? 'playlist' : 'track',
              sourcePlaylistId: state.music.contentType === MusicContentType.playlist ? state.music.id : null,
            },
            create: {
              userId,
              musicId: targetId,
              sourceType: state.music.contentType === MusicContentType.playlist ? 'playlist' : 'track',
              sourcePlaylistId: state.music.contentType === MusicContentType.playlist ? state.music.id : null,
              creditsSpent: targetId === state.music.id ? chargedCredits : 0,
            },
          }),
        ),
      );

      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'spend',
          amount: -chargedCredits,
          balanceBefore: user.credits,
          balanceAfter: updatedUser.credits,
          referenceId: state.music.id,
          description: state.music.contentType === MusicContentType.playlist
            ? `Mở khóa playlist nhạc: ${state.music.title}`
            : `Mở khóa bài nhạc: ${state.music.title}`,
        },
      });

      return {
        balance: updatedUser.credits,
        unlockTargetCount: unlockTargetIds.length,
      };
    });

    return {
      data: {
        musicId: state.music.id,
        contentType: state.music.contentType,
        unlocked: true,
        unlockPrice: state.music.unlockPrice,
        chargedCredits,
        balance: result.balance,
        unlockTargetCount: result.unlockTargetCount,
      },
    };
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

    const existing = await this.prisma.musicHistory.findFirst({
      where: {
        userId,
        musicId,
      },
      orderBy: { listenedAt: 'desc' },
      select: { id: true },
    });

    const now = new Date();

    const row = existing
      ? await this.prisma.musicHistory.update({
          where: { id: existing.id },
          data: {
            listenedAt: now,
          },
        })
      : await this.prisma.musicHistory.create({
          data: {
            userId,
            musicId,
            listenedAt: now,
          },
        });

    return {
      data: row,
    };
  }

  async updateHistoryProgress(userId: string, musicId: string, progressSeconds: number) {
    await this.ensureMusic(musicId);

    const nextProgress = this.normalizeProgressSeconds(progressSeconds);
    const now = new Date();

    const existing = await this.prisma.musicHistory.findFirst({
      where: {
        userId,
        musicId,
      },
      orderBy: { listenedAt: 'desc' },
      select: { id: true },
    });

    const row = existing
      ? await this.prisma.musicHistory.update({
          where: { id: existing.id },
          data: {
            progressSeconds: nextProgress,
            listenedAt: now,
          },
        })
      : await this.prisma.musicHistory.create({
          data: {
            userId,
            musicId,
            progressSeconds: nextProgress,
            listenedAt: now,
          },
        });

    return {
      data: {
        id: row.id,
        userId: row.userId,
        musicId: row.musicId,
        progressSeconds: row.progressSeconds,
        listenedAt: row.listenedAt,
        updatedAt: row.listenedAt,
      },
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
