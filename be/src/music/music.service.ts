import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { AudioUploadService } from '@/upload/audio-upload.service';
import { CreateMusicDto } from './dto/create-music.dto';
import { MusicQueryDto } from './dto/music-query.dto';
import { UpdateMusicDto } from './dto/update-music.dto';

type UploadFiles = {
  audioFile?: Express.Multer.File[];
  thumbnailFile?: Express.Multer.File[];
};

@Injectable()
export class MusicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audioUploadService: AudioUploadService,
  ) {}

  async findPublic(query: MusicQueryDto) {
    return this.findByQuery(query, true);
  }

  async findAllAdmin(query: MusicQueryDto) {
    return this.findByQuery(query, false);
  }

  async findOnePublic(id: string) {
    const row = await this.prisma.music.findFirst({
      where: {
        id,
        isPublic: true,
      },
    });

    if (!row) {
      throw new NotFoundException('Music not found.');
    }

    return {
      data: this.serializeMusic(row),
    };
  }

  async incrementPlayCount(id: string) {
    try {
      const row = await this.prisma.music.update({
        where: { id },
        data: {
          playCount: { increment: 1 },
        },
      });

      return {
        data: {
          id: row.id,
          playCount: row.playCount,
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Music not found.');
      }

      throw error;
    }
  }

  private async findByQuery(query: MusicQueryDto, onlyPublic: boolean) {
    const page = query.page || 1;
    const limit = query.limit || 12;
    const normalizedSearch = query.search?.trim();
    const normalizedTag = query.tag?.trim().toLowerCase();

    const where: Prisma.MusicWhereInput = {
      ...(onlyPublic ? { isPublic: true } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { title: { contains: normalizedSearch } },
              { artist: { contains: normalizedSearch } },
              { description: { contains: normalizedSearch } },
            ],
          }
        : {}),
    };

    if (!normalizedTag) {
      const [total, rows] = await Promise.all([
        this.prisma.music.count({ where }),
        this.prisma.music.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ createdAt: 'desc' }],
        }),
      ]);

      return {
        data: rows.map((item) => this.serializeMusic(item)),
        meta: {
          total,
          page,
          lastPage: Math.max(1, Math.ceil(total / limit)),
        },
      };
    }

    const allRows = await this.prisma.music.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });

    const filtered = allRows.filter((item) =>
      this.parseTags(item.tags).some((tag) => tag.toLowerCase() === normalizedTag),
    );

    const paged = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);

    return {
      data: paged.map((item) => this.serializeMusic(item)),
      meta: {
        total: filtered.length,
        page,
        lastPage: Math.max(1, Math.ceil(filtered.length / limit)),
      },
    };
  }

  async create(dto: CreateMusicDto, files: UploadFiles) {
    const title = this.normalizeRequiredText(dto.title, 'title');
    const artist = this.normalizeRequiredText(dto.artist, 'artist');

    const audioFile = files.audioFile?.[0];
    const thumbnailFile = files.thumbnailFile?.[0];

    const audioUrlFromBody = this.normalizeOptionalText(dto.audioUrl);
    const thumbnailUrlFromBody = this.normalizeOptionalText(dto.thumbnailUrl);

    const audioUrl = audioFile
      ? await this.audioUploadService.uploadAudio(audioFile, 'music')
      : audioUrlFromBody;

    if (!audioUrl) {
      throw new BadRequestException('audioFile or audioUrl is required.');
    }

    const thumbnailUrl = thumbnailFile
      ? await this.audioUploadService.uploadMusicThumbnail(thumbnailFile)
      : thumbnailUrlFromBody;

    const created = await this.prisma.music.create({
      data: {
        title,
        artist,
        description: this.normalizeNullableText(dto.description),
        tags: this.normalizeTagsInput(dto.tags),
        audioUrl,
        thumbnailUrl,
        audioDuration: this.normalizeDuration(dto.audioDuration),
        isPublic: dto.isPublic ?? true,
      },
    });

    return this.serializeMusic(created);
  }

  async update(id: string, dto: UpdateMusicDto, files: UploadFiles) {
    const existing = await this.prisma.music.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Music not found.');
    }

    const audioFile = files.audioFile?.[0];
    const thumbnailFile = files.thumbnailFile?.[0];

    const nextTitle = dto.title === undefined ? undefined : this.normalizeRequiredText(dto.title, 'title');
    const nextArtist = dto.artist === undefined ? undefined : this.normalizeRequiredText(dto.artist, 'artist');

    const audioUrlFromBody = dto.audioUrl === undefined
      ? undefined
      : this.normalizeRequiredText(dto.audioUrl, 'audioUrl');
    const thumbnailUrlFromBody = this.normalizeNullableText(dto.thumbnailUrl);
    const nextDescription = dto.description === undefined ? undefined : this.normalizeNullableText(dto.description);

    const nextAudioUrl = audioFile
      ? await this.audioUploadService.uploadAudio(audioFile, 'music')
      : audioUrlFromBody;

    const nextThumbnailUrl = thumbnailFile
      ? await this.audioUploadService.uploadMusicThumbnail(thumbnailFile)
      : thumbnailUrlFromBody;

    const data: Prisma.MusicUpdateInput = {
      ...(nextTitle !== undefined ? { title: nextTitle } : {}),
      ...(nextArtist !== undefined ? { artist: nextArtist } : {}),
      ...(nextAudioUrl !== undefined ? { audioUrl: nextAudioUrl } : {}),
      ...(nextThumbnailUrl !== undefined ? { thumbnailUrl: nextThumbnailUrl } : {}),
      ...(nextDescription !== undefined ? { description: nextDescription } : {}),
      ...(dto.tags !== undefined ? { tags: this.normalizeTagsInput(dto.tags) } : {}),
      ...(dto.audioDuration !== undefined ? { audioDuration: this.normalizeDuration(dto.audioDuration) } : {}),
      ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
    };

    const updated = await this.prisma.music.update({
      where: { id },
      data,
    });

    return this.serializeMusic(updated);
  }

  async remove(id: string) {
    const existing = await this.prisma.music.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      throw new NotFoundException('Music not found.');
    }

    await this.prisma.music.delete({ where: { id } });

    return { success: true };
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

  private parseTags(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  private normalizeTagsInput(value: string[] | undefined): Prisma.InputJsonValue {
    if (!value?.length) return [];

    const deduped = Array.from(
      new Set(
        value
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

    return deduped;
  }

  private normalizeRequiredText(value: string | undefined, field: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(`${field} is required.`);
    }
    return normalized;
  }

  private normalizeOptionalText(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  private normalizeNullableText(value: string | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private normalizeDuration(value: number | undefined): number | null {
    if (value === undefined || value === null) return null;
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException('audioDuration must be a non-negative number.');
    }
    return Math.round(value);
  }
}
