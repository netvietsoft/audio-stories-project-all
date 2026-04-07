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

  private async findByQuery(query: MusicQueryDto, onlyPublic: boolean) {
    const page = query.page || 1;
    const limit = query.limit || 12;

    const where: Prisma.MusicWhereInput = {
      ...(onlyPublic ? { isPublic: true } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { artist: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.music.count({ where }),
      this.prisma.music.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
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

    return this.prisma.music.create({
      data: {
        title,
        artist,
        audioUrl,
        thumbnailUrl,
        audioDuration: this.normalizeDuration(dto.audioDuration),
        isPublic: dto.isPublic ?? true,
      },
    });
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
      ...(dto.audioDuration !== undefined ? { audioDuration: this.normalizeDuration(dto.audioDuration) } : {}),
      ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
    };

    return this.prisma.music.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.music.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      throw new NotFoundException('Music not found.');
    }

    await this.prisma.music.delete({ where: { id } });

    return { success: true };
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
