import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { CreatePersonalPlaylistDto } from './dto/create-personal-playlist.dto';
import { UpdatePersonalPlaylistDto } from './dto/update-personal-playlist.dto';

@Injectable()
export class PersonalPlaylistService {
  private readonly DEFAULT_COVER_IMAGE = '/thumbnaildefault.jpg';

  constructor(private readonly prisma: PrismaService) {}

  private normalizeRequiredTitle(value: string | undefined) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException('title is required.');
    }
    return normalized;
  }

  private normalizeCoverImage(value: string | undefined) {
    const normalized = value?.trim();
    return normalized || this.DEFAULT_COVER_IMAGE;
  }

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
    };
  }

  private serializeSummary(row: {
    id: string;
    userId: string;
    title: string;
    isPublic: boolean;
    coverImage: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
      tracks: number;
    };
  }) {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      isPublic: row.isPublic,
      coverImage: row.coverImage || this.DEFAULT_COVER_IMAGE,
      totalTracks: row._count?.tracks || 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async ensureOwnedPlaylist(userId: string, playlistId: string) {
    const playlist = await this.prisma.musicPlaylist.findFirst({
      where: {
        id: playlistId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found.');
    }

    return playlist;
  }

  async create(userId: string, dto: CreatePersonalPlaylistDto) {
    const created = await this.prisma.musicPlaylist.create({
      data: {
        userId,
        title: this.normalizeRequiredTitle(dto.title),
        coverImage: this.normalizeCoverImage(dto.coverImage),
      },
      include: {
        _count: {
          select: {
            tracks: true,
          },
        },
      },
    });

    return {
      data: this.serializeSummary(created),
    };
  }

  async listMine(userId: string) {
    const rows = await this.prisma.musicPlaylist.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        _count: {
          select: {
            tracks: true,
          },
        },
      },
    });

    return {
      data: rows.map((row) => this.serializeSummary(row)),
    };
  }

  async getDetail(userId: string, playlistId: string) {
    const row = await this.prisma.musicPlaylist.findFirst({
      where: {
        id: playlistId,
        userId,
      },
      include: {
        tracks: {
          orderBy: {
            orderIndex: 'asc',
          },
          include: {
            music: true,
          },
        },
        _count: {
          select: {
            tracks: true,
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('Playlist not found.');
    }

    return {
      data: {
        ...this.serializeSummary(row),
        tracks: row.tracks.map((item) => ({
          playlistId: item.playlistId,
          musicId: item.musicId,
          orderIndex: item.orderIndex,
          addedAt: item.addedAt,
          music: this.serializeMusic(item.music),
        })),
      },
    };
  }

  async updateTitle(userId: string, playlistId: string, dto: UpdatePersonalPlaylistDto) {
    await this.ensureOwnedPlaylist(userId, playlistId);

    const updated = await this.prisma.musicPlaylist.update({
      where: {
        id: playlistId,
      },
      data: {
        title: this.normalizeRequiredTitle(dto.title),
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            tracks: true,
          },
        },
      },
    });

    return {
      data: this.serializeSummary(updated),
    };
  }

  async addTrack(userId: string, playlistId: string, musicId: string) {
    await this.ensureOwnedPlaylist(userId, playlistId);

    const music = await this.prisma.music.findFirst({
      where: {
        id: musicId,
        isPublic: true,
      },
      select: {
        id: true,
      },
    });

    if (!music) {
      throw new NotFoundException('Music not found.');
    }

    const existing = await this.prisma.musicPlaylistTrack.findUnique({
      where: {
        playlistId_musicId: {
          playlistId,
          musicId,
        },
      },
      select: {
        playlistId: true,
      },
    });

    if (existing) {
      const totalTracks = await this.prisma.musicPlaylistTrack.count({
        where: {
          playlistId,
        },
      });

      return {
        data: {
          playlistId,
          musicId,
          added: false,
          totalTracks,
        },
      };
    }

    await this.prisma.$transaction(async (tx) => {
      const aggregate = await tx.musicPlaylistTrack.aggregate({
        where: {
          playlistId,
        },
        _max: {
          orderIndex: true,
        },
      });

      const nextOrder = (aggregate._max.orderIndex ?? -1) + 1;

      await tx.musicPlaylistTrack.create({
        data: {
          playlistId,
          musicId,
          orderIndex: nextOrder,
        },
      });

      await tx.musicPlaylist.update({
        where: { id: playlistId },
        data: {
          updatedAt: new Date(),
        },
      });
    });

    const totalTracks = await this.prisma.musicPlaylistTrack.count({
      where: {
        playlistId,
      },
    });

    return {
      data: {
        playlistId,
        musicId,
        added: true,
        totalTracks,
      },
    };
  }

  async removeTrack(userId: string, playlistId: string, musicId: string) {
    await this.ensureOwnedPlaylist(userId, playlistId);

    const existing = await this.prisma.musicPlaylistTrack.findUnique({
      where: {
        playlistId_musicId: {
          playlistId,
          musicId,
        },
      },
      select: {
        playlistId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Track not found in playlist.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.musicPlaylistTrack.delete({
        where: {
          playlistId_musicId: {
            playlistId,
            musicId,
          },
        },
      });

      await tx.musicPlaylist.update({
        where: { id: playlistId },
        data: {
          updatedAt: new Date(),
        },
      });
    });

    const totalTracks = await this.prisma.musicPlaylistTrack.count({
      where: {
        playlistId,
      },
    });

    return {
      data: {
        playlistId,
        musicId,
        removed: true,
        totalTracks,
      },
    };
  }

  async removePlaylist(userId: string, playlistId: string) {
    await this.ensureOwnedPlaylist(userId, playlistId);

    await this.prisma.musicPlaylist.delete({
      where: {
        id: playlistId,
      },
    });

    return {
      ok: true,
    };
  }
}
