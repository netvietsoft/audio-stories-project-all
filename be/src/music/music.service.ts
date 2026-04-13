import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MusicContentType, Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { AudioUploadService } from '@/upload/audio-upload.service';
import { CreateMusicDto } from './dto/create-music.dto';
import { MusicQueryDto } from './dto/music-query.dto';
import { UpdateMusicDto } from './dto/update-music.dto';

type UploadFiles = {
  audioFile?: Express.Multer.File[];
  thumbnailFile?: Express.Multer.File[];
};

type PlaylistTrackSummary = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  audioUrl: string;
  audioDuration: number | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
};

type SerializableMusicRow = {
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
  playlistTrackIds: Prisma.JsonValue | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
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

  async findOnePublic(slug: string) {
    const row = await this.prisma.music.findFirst({
      where: {
        slug,
        isPublic: true,
      },
    });

    if (!row) {
      throw new NotFoundException('Music not found.');
    }

    const [serialized] = await this.enrichPlaylistTracks([row]);

    return {
      data: serialized,
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
    const normalizedContentType = query.contentType?.trim() as MusicContentType | undefined;

    const whereClauses: Prisma.MusicWhereInput[] = [];

    if (onlyPublic) {
      whereClauses.push({ isPublic: true });
    }

    if (normalizedContentType) {
      whereClauses.push({ contentType: normalizedContentType });
    }

    if (normalizedSearch) {
      whereClauses.push({
        OR: [
          { title: { contains: normalizedSearch } },
          { artist: { contains: normalizedSearch } },
          { description: { contains: normalizedSearch } },
        ],
      });
    }

    if (onlyPublic) {
      const childTrackIds = await this.listPlaylistChildTrackIds();

      if (childTrackIds.length && normalizedContentType !== MusicContentType.playlist) {
        if (normalizedContentType === MusicContentType.single) {
          whereClauses.push({ id: { notIn: childTrackIds } });
        } else {
          whereClauses.push({
            OR: [
              { contentType: MusicContentType.playlist },
              {
                AND: [
                  { contentType: MusicContentType.single },
                  { id: { notIn: childTrackIds } },
                ],
              },
            ],
          });
        }
      }
    }

    const where: Prisma.MusicWhereInput = whereClauses.length ? { AND: whereClauses } : {};

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

      const enrichedRows = await this.enrichPlaylistTracks(rows);

      return {
        data: enrichedRows,
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
    const enrichedRows = await this.enrichPlaylistTracks(paged);

    return {
      data: enrichedRows,
      meta: {
        total: filtered.length,
        page,
        lastPage: Math.max(1, Math.ceil(filtered.length / limit)),
      },
    };
  }

  async create(dto: CreateMusicDto, files: UploadFiles) {
    const title = this.normalizeRequiredText(dto.title, 'title');
    const slug = await this.generateUniqueSlug(title, dto.slug);
    const artist = this.normalizeRequiredText(dto.artist, 'artist');
    const contentType = this.normalizeContentType(dto.contentType);
    const playlistTrackIds = this.normalizeMusicIdArray(dto.playlistTrackIds);

    const audioFile = files.audioFile?.[0];
    const thumbnailFile = files.thumbnailFile?.[0];

    const audioUrlFromBody = this.normalizeOptionalText(dto.audioUrl);
    const thumbnailUrlFromBody = this.normalizeOptionalText(dto.thumbnailUrl);

    let resolvedPlaylistTracks: PlaylistTrackSummary[] = [];
    let audioUrl: string | undefined;
    let audioDuration: number | null = this.normalizeDuration(dto.audioDuration);

    if (contentType === MusicContentType.playlist) {
      if (!playlistTrackIds.length) {
        throw new BadRequestException('playlistTrackIds is required for playlist content.');
      }

      resolvedPlaylistTracks = await this.resolvePlaylistTracks(playlistTrackIds);
      audioUrl = resolvedPlaylistTracks[0]?.audioUrl;
      audioDuration = resolvedPlaylistTracks.reduce((sum, item) => sum + (item.audioDuration || 0), 0);
    } else {
      audioUrl = audioFile
        ? await this.audioUploadService.uploadAudio(audioFile, 'music')
        : audioUrlFromBody;
    }

    if (!audioUrl) {
      throw new BadRequestException(
        contentType === MusicContentType.playlist
          ? 'playlistTrackIds must contain at least one playable track.'
          : 'audioFile or audioUrl is required.',
      );
    }

    const uploadedThumbnailUrl = thumbnailFile
      ? await this.audioUploadService.uploadMusicThumbnail(thumbnailFile)
      : thumbnailUrlFromBody;

    const thumbnailUrl = uploadedThumbnailUrl
      ?? (contentType === MusicContentType.playlist ? resolvedPlaylistTracks[0]?.thumbnailUrl || null : null);

    const created = await this.prisma.music.create({
      data: {
        title,
        slug,
        artist,
        description: this.normalizeNullableText(dto.description),
        tags: this.normalizeTagsInput(dto.tags),
        audioUrl,
        thumbnailUrl,
        audioDuration,
        contentType,
        playlistTrackIds: contentType === MusicContentType.playlist ? playlistTrackIds : [],
        isPublic: dto.isPublic ?? true,
      },
    });

    const [serialized] = await this.enrichPlaylistTracks([created]);

    return serialized;
  }

  async update(id: string, dto: UpdateMusicDto, files: UploadFiles) {
    const existing = await this.prisma.music.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Music not found.');
    }

    const audioFile = files.audioFile?.[0];
    const thumbnailFile = files.thumbnailFile?.[0];

    const nextContentType = dto.contentType
      ? this.normalizeContentType(dto.contentType)
      : existing.contentType;

    const nextPlaylistTrackIds = dto.playlistTrackIds === undefined
      ? this.parsePlaylistTrackIds(existing.playlistTrackIds)
      : this.normalizeMusicIdArray(dto.playlistTrackIds);

    const nextTitle = dto.title === undefined ? undefined : this.normalizeRequiredText(dto.title, 'title');
    const titleForSlug = nextTitle ?? existing.title;
    const requestedSlug = dto.slug === undefined ? existing.slug : dto.slug;
    const nextSlug = await this.generateUniqueSlug(titleForSlug, requestedSlug, id);
    const nextArtist = dto.artist === undefined ? undefined : this.normalizeRequiredText(dto.artist, 'artist');

    const audioUrlFromBody = dto.audioUrl === undefined
      ? undefined
      : this.normalizeRequiredText(dto.audioUrl, 'audioUrl');
    const thumbnailUrlFromBody = this.normalizeNullableText(dto.thumbnailUrl);
    const nextDescription = dto.description === undefined ? undefined : this.normalizeNullableText(dto.description);

    const uploadedAudioUrl = audioFile
      ? await this.audioUploadService.uploadAudio(audioFile, 'music')
      : undefined;

    const uploadedThumbnailUrl = thumbnailFile
      ? await this.audioUploadService.uploadMusicThumbnail(thumbnailFile)
      : undefined;

    let resolvedPlaylistTracks: PlaylistTrackSummary[] = [];
    let derivedAudioUrl: string | undefined;
    let derivedDuration: number | null | undefined;
    let derivedThumbnail: string | null | undefined;

    if (nextContentType === MusicContentType.playlist) {
      if (!nextPlaylistTrackIds.length) {
        throw new BadRequestException('playlistTrackIds is required for playlist content.');
      }

      resolvedPlaylistTracks = await this.resolvePlaylistTracks(nextPlaylistTrackIds, id);
      derivedAudioUrl = resolvedPlaylistTracks[0]?.audioUrl;
      derivedDuration = resolvedPlaylistTracks.reduce((sum, item) => sum + (item.audioDuration || 0), 0);
      derivedThumbnail = resolvedPlaylistTracks[0]?.thumbnailUrl || null;

      if (!derivedAudioUrl) {
        throw new BadRequestException('playlistTrackIds must contain at least one playable track.');
      }
    }

    let nextAudioUrl = uploadedAudioUrl ?? audioUrlFromBody;
    let nextDuration = dto.audioDuration !== undefined ? this.normalizeDuration(dto.audioDuration) : undefined;

    if (nextContentType === MusicContentType.playlist) {
      nextAudioUrl = derivedAudioUrl;
      nextDuration = derivedDuration;
    }

    if (nextContentType === MusicContentType.single && !nextAudioUrl && !existing.audioUrl) {
      throw new BadRequestException('audioFile or audioUrl is required.');
    }

    let nextThumbnailUrl: string | null | undefined = uploadedThumbnailUrl ?? thumbnailUrlFromBody;

    if (nextContentType === MusicContentType.playlist && nextThumbnailUrl === undefined) {
      nextThumbnailUrl = existing.thumbnailUrl || derivedThumbnail || null;
    }

    const data: Prisma.MusicUpdateInput = {
      ...(nextTitle !== undefined ? { title: nextTitle } : {}),
      ...(nextSlug !== existing.slug ? { slug: nextSlug } : {}),
      ...(nextArtist !== undefined ? { artist: nextArtist } : {}),
      ...(nextAudioUrl !== undefined ? { audioUrl: nextAudioUrl } : {}),
      ...(nextThumbnailUrl !== undefined ? { thumbnailUrl: nextThumbnailUrl } : {}),
      ...(nextDescription !== undefined ? { description: nextDescription } : {}),
      ...(dto.tags !== undefined ? { tags: this.normalizeTagsInput(dto.tags) } : {}),
      ...(nextDuration !== undefined ? { audioDuration: nextDuration } : {}),
      ...(dto.contentType !== undefined ? { contentType: nextContentType } : {}),
      ...(dto.playlistTrackIds !== undefined || nextContentType === MusicContentType.playlist || existing.contentType === MusicContentType.playlist
        ? { playlistTrackIds: nextContentType === MusicContentType.playlist ? nextPlaylistTrackIds : [] }
        : {}),
      ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
    };

    const updated = await this.prisma.music.update({
      where: { id },
      data,
    });

    const [serialized] = await this.enrichPlaylistTracks([updated]);

    return serialized;
  }

  async remove(id: string) {
    const existing = await this.prisma.music.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      throw new NotFoundException('Music not found.');
    }

    await this.prisma.music.delete({ where: { id } });

    return { success: true };
  }

  private serializeMusic(row: SerializableMusicRow, playlistTracks: PlaylistTrackSummary[] = []) {
    return {
      ...row,
      tags: this.parseTags(row.tags),
      playlistTrackIds: this.parsePlaylistTrackIds(row.playlistTrackIds),
      playlistTracks,
    };
  }

  private async enrichPlaylistTracks(rows: SerializableMusicRow[]) {
    if (!rows.length) return [];

    const playlistRows = rows.filter((row) => row.contentType === MusicContentType.playlist);
    if (!playlistRows.length) {
      return rows.map((row) => this.serializeMusic(row));
    }

    const allTrackIds = new Set<string>();
    playlistRows.forEach((row) => {
      this.parsePlaylistTrackIds(row.playlistTrackIds).forEach((id) => allTrackIds.add(id));
    });

    const ids = Array.from(allTrackIds);
    const trackRows = ids.length
      ? await this.prisma.music.findMany({
          where: {
            id: { in: ids },
            contentType: MusicContentType.single,
          },
          select: {
            id: true,
            slug: true,
            title: true,
            artist: true,
            thumbnailUrl: true,
            audioUrl: true,
            audioDuration: true,
            playCount: true,
            likeCount: true,
            commentCount: true,
          },
        })
      : [];

    const trackMap = new Map(trackRows.map((item) => [item.id, item]));

    return rows.map((row) => {
      if (row.contentType !== MusicContentType.playlist) {
        return this.serializeMusic(row);
      }

      const playlistTracks = this.parsePlaylistTrackIds(row.playlistTrackIds)
        .map((id) => trackMap.get(id))
        .filter((item): item is (typeof trackRows)[number] => Boolean(item))
        .map((item) => ({
          id: item.id,
          slug: item.slug,
          title: item.title,
          artist: item.artist,
          thumbnailUrl: item.thumbnailUrl,
          audioUrl: item.audioUrl,
          audioDuration: item.audioDuration,
          playCount: item.playCount,
          likeCount: item.likeCount,
          commentCount: item.commentCount,
        }));

      return this.serializeMusic(row, playlistTracks);
    });
  }

  private parseTags(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  private parsePlaylistTrackIds(value: Prisma.JsonValue | null): string[] {
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

  private normalizeMusicIdArray(value: string[] | undefined): string[] {
    if (!value?.length) return [];

    return Array.from(
      new Set(
        value
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  private normalizeContentType(value: string | undefined): MusicContentType {
    return value === 'playlist' ? MusicContentType.playlist : MusicContentType.single;
  }

  private toSlug(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  private async generateUniqueSlug(title: string, requestedSlug?: string, excludeId?: string): Promise<string> {
    const source = this.normalizeOptionalText(requestedSlug) ?? title;
    const baseSlug = this.toSlug(source) || `music-${Date.now()}`;

    let index = 0;

    while (true) {
      const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
      const existing = await this.prisma.music.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing || existing.id === excludeId) {
        return candidate;
      }

      index += 1;
    }
  }

  private async listPlaylistChildTrackIds(): Promise<string[]> {
    const playlists = await this.prisma.music.findMany({
      where: {
        isPublic: true,
        contentType: MusicContentType.playlist,
      },
      select: {
        playlistTrackIds: true,
      },
    });

    const ids = new Set<string>();

    playlists.forEach((playlist) => {
      this.parsePlaylistTrackIds(playlist.playlistTrackIds).forEach((id) => ids.add(id));
    });

    return Array.from(ids);
  }

  private async resolvePlaylistTracks(trackIds: string[], excludeMusicId?: string): Promise<PlaylistTrackSummary[]> {
    const normalizedIds = this.normalizeMusicIdArray(trackIds).filter((id) => id !== excludeMusicId);

    if (!normalizedIds.length) {
      throw new BadRequestException('playlistTrackIds is required for playlist content.');
    }

    const rows = await this.prisma.music.findMany({
      where: {
        id: { in: normalizedIds },
        contentType: MusicContentType.single,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        artist: true,
        thumbnailUrl: true,
        audioUrl: true,
        audioDuration: true,
        playCount: true,
        likeCount: true,
        commentCount: true,
      },
    });

    if (rows.length !== normalizedIds.length) {
      throw new BadRequestException('playlistTrackIds contains invalid or non-single-track IDs.');
    }

    const map = new Map(rows.map((item) => [item.id, item]));

    return normalizedIds.map((id) => {
      const item = map.get(id);
      if (!item) {
        throw new BadRequestException('playlistTrackIds contains invalid IDs.');
      }

      return {
        id: item.id,
        slug: item.slug,
        title: item.title,
        artist: item.artist,
        thumbnailUrl: item.thumbnailUrl,
        audioUrl: item.audioUrl,
        audioDuration: item.audioDuration,
        playCount: item.playCount,
        likeCount: item.likeCount,
        commentCount: item.commentCount,
      };
    });
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
