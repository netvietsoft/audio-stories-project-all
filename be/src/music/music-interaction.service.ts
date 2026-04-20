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
        unlockPrice: 0,
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
        unlockPrice: music.unlockPrice,
        unlocked: true,
        unlockSource: directUnlock.sourceType,
      };
    }

    if (music.contentType !== MusicContentType.playlist) {
      const playlistUnlock = await this.findPlaylistUnlockForTrack(userId, music.id);

      if (playlistUnlock) {
        return {
          music,
          unlockPrice: music.unlockPrice,
          unlocked: true,
          unlockSource: 'playlist' as const,
        };
      }

      return {
        music,
        unlockPrice: music.unlockPrice,
        unlocked: false,
        unlockSource: null,
      };
    }

    const discountedPlaylistPrice = await this.calculateDiscountedPlaylistUnlockPrice(userId, music.id, music.unlockPrice);

    if (discountedPlaylistPrice <= 0) {
      return {
        music,
        unlockPrice: 0,
        unlocked: true,
        unlockSource: 'track' as const,
      };
    }

    // Playlist access must come from direct playlist unlock.
    // Track-level unlocks are evaluated when playing each child track.
    return {
      music,
      unlockPrice: discountedPlaylistPrice,
      unlocked: false,
      unlockSource: null,
    };
  }

  async getAccessStatus(userId: string, musicId: string) {
    const state = await this.getPlayableState(userId, musicId);

    return {
      data: {
        musicId: state.music.id,
        contentType: state.music.contentType,
        accessType: state.music.accessType,
        unlockPrice: state.unlockPrice,
        unlocked: state.unlocked,
        canPlay: state.unlocked,
        unlockSource: state.unlockSource,
      },
    };
  }

  private async calculateDiscountedPlaylistUnlockPrice(userId: string, playlistId: string, playlistPrice: number) {
    const playlist = await this.prisma.music.findUnique({
      where: { id: playlistId },
      select: {
        playlistTrackIds: true,
      },
    });

    const trackIds = this.parsePlaylistTrackIds(playlist?.playlistTrackIds ?? null);
    if (!trackIds.length) {
      return Math.max(0, playlistPrice);
    }

    const tracks = await this.prisma.music.findMany({
      where: {
        id: { in: trackIds },
        accessType: MusicAccessType.vip,
        unlockPrice: { gt: 0 },
      },
      select: {
        id: true,
        unlockPrice: true,
      },
    });

    if (!tracks.length) {
      return Math.max(0, playlistPrice);
    }

    const unlockedRows = await this.prisma.musicUnlock.findMany({
      where: {
        userId,
        musicId: {
          in: tracks.map((track) => track.id),
        },
      },
      select: {
        musicId: true,
      },
    });

    if (!unlockedRows.length) {
      return Math.max(0, playlistPrice);
    }

    const unlockedTrackIds = new Set(unlockedRows.map((row) => row.musicId));
    const totalDiscount = tracks.reduce((sum, track) => {
      if (!unlockedTrackIds.has(track.id)) return sum;
      return sum + Math.max(0, Math.floor(track.unlockPrice || 0));
    }, 0);

    return Math.max(0, Math.floor(playlistPrice) - totalDiscount);
  }

  private async findPlaylistUnlockForTrack(userId: string, musicId: string) {
    const parentPlaylists = await this.prisma.music.findMany({
      where: {
        contentType: MusicContentType.playlist,
      },
      select: {
        id: true,
        playlistTrackIds: true,
      },
    });

    const matchingPlaylistIds = parentPlaylists
      .filter((playlist) => this.parsePlaylistTrackIds(playlist.playlistTrackIds).includes(musicId))
      .map((playlist) => playlist.id);

    if (!matchingPlaylistIds.length) {
      return null;
    }

    return this.prisma.musicUnlock.findFirst({
      where: {
        userId,
        sourceType: 'playlist',
        sourcePlaylistId: {
          in: matchingPlaylistIds,
        },
      },
      select: {
        id: true,
      },
    });
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
          unlockPrice: state.unlockPrice,
          chargedCredits: 0,
          balance: user?.credits ?? 0,
          unlockSource: state.unlockSource,
        },
      };
    }

    if (state.music.accessType !== MusicAccessType.vip || state.unlockPrice <= 0) {
      throw new BadRequestException('This track does not require paid unlock.');
    }

    const chargedCredits = state.unlockPrice;

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
        unlockPrice: state.unlockPrice,
        chargedCredits,
        balance: result.balance,
        unlockSource: state.music.contentType === MusicContentType.playlist ? 'playlist' : 'track',
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

  async listUnlocked(userId: string, query: ListMusicHistoryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 20), 100);

    const where: Prisma.MusicUnlockWhereInput = { userId };

    const [total, rows] = await Promise.all([
      this.prisma.musicUnlock.count({ where }),
      this.prisma.musicUnlock.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          music: true,
          sourcePlaylist: {
            select: {
              id: true,
              slug: true,
              title: true,
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        unlockedAt: row.createdAt,
        sourceType: row.sourceType,
        creditsSpent: row.creditsSpent,
        music: this.serializeMusic(row.music),
        sourcePlaylist: row.sourcePlaylist,
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
