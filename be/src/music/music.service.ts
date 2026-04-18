import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MusicAccessType, MusicContentType, Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { AudioUploadService } from '@/upload/audio-upload.service';
import { CreateMusicDto } from './dto/create-music.dto';
import { MusicQueryDto } from './dto/music-query.dto';
import { UpdateMusicDto } from './dto/update-music.dto';

type UploadFiles = {
  audioFile?: Express.Multer.File[];
  thumbnailFile?: Express.Multer.File[];
};

type PlaylistTrackAccessInput = {
  trackId: string;
  accessType?: string;
  unlockPrice?: number;
};

type PlaylistTrackSummary = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  accessType: MusicAccessType;
  originalUnlockPrice: number | null;
  discountPercent: number;
  unlockPrice: number;
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
  accessType: MusicAccessType;
  originalUnlockPrice: number | null;
  discountPercent: number;
  unlockPrice: number;
  introEnabled: boolean;
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

  async findRelatedPublic(slug: string, limit = 8) {
    const safeLimit = Math.min(Math.max(limit || 8, 1), 20);

    const source = await this.prisma.music.findFirst({
      where: {
        slug,
        isPublic: true,
      },
    });

    if (!source) {
      throw new NotFoundException('Music not found.');
    }

    const sourceArtist = source.artist.trim().toLowerCase();
    const sourceTags = new Set(this.parseTags(source.tags).map((tag) => tag.toLowerCase()));

    const candidates = await this.prisma.music.findMany({
      where: {
        isPublic: true,
        id: { not: source.id },
      },
      orderBy: [{ playCount: 'desc' }, { createdAt: 'desc' }],
      take: 120,
    });

    const sameArtist: SerializableMusicRow[] = [];
    const sameTag: SerializableMusicRow[] = [];
    const fallback: SerializableMusicRow[] = [];

    candidates.forEach((row) => {
      const rowArtist = row.artist.trim().toLowerCase();
      const tags = this.parseTags(row.tags).map((tag) => tag.toLowerCase());
      const hasSameArtist = Boolean(sourceArtist) && rowArtist === sourceArtist;
      const hasSameTag = tags.some((tag) => sourceTags.has(tag));

      if (hasSameArtist) {
        sameArtist.push(row);
        return;
      }

      if (hasSameTag) {
        sameTag.push(row);
        return;
      }

      fallback.push(row);
    });

    const deduped: SerializableMusicRow[] = [];
    const seen = new Set<string>();

    [...sameArtist, ...sameTag, ...fallback].forEach((row) => {
      if (seen.has(row.id)) return;
      seen.add(row.id);
      deduped.push(row);
    });

    const enrichedRows = await this.enrichPlaylistTracks(deduped.slice(0, safeLimit));

    return {
      data: enrichedRows,
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
        if (normalizedContentType === MusicContentType.single || normalizedContentType === MusicContentType.podcast) {
          whereClauses.push({ id: { notIn: childTrackIds } });
        } else {
          whereClauses.push({
            OR: [
              { contentType: MusicContentType.playlist },
              {
                AND: [
                  { contentType: { in: [MusicContentType.single, MusicContentType.podcast] } },
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
    const accessType = this.normalizeAccessType(dto.accessType);
    const pricing = this.resolveMusicPricing(accessType, {
      unlockPrice: dto.unlockPrice,
      originalUnlockPrice: dto.originalUnlockPrice,
      discountPercent: dto.discountPercent,
    });
    const playlistTrackIds = this.normalizeMusicIdArray(dto.playlistTrackIds);
    const playlistTrackAccess = this.normalizePlaylistTrackAccessInput(dto.playlistTrackAccess, playlistTrackIds);

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

    const created = await this.prisma.$transaction(async (tx) => {
      if (contentType === MusicContentType.playlist && playlistTrackAccess.size) {
        await this.applyPlaylistTrackAccessConfig(tx, resolvedPlaylistTracks, playlistTrackAccess);
      }

      return tx.music.create({
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
          accessType,
          originalUnlockPrice: pricing.originalUnlockPrice,
          discountPercent: pricing.discountPercent,
          unlockPrice: pricing.unlockPrice,
          introEnabled: dto.introEnabled ?? true,
          playlistTrackIds: contentType === MusicContentType.playlist ? playlistTrackIds : [],
          isPublic: dto.isPublic ?? true,
        },
      });
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

    const nextAccessType = dto.accessType
      ? this.normalizeAccessType(dto.accessType)
      : existing.accessType;

    const nextPricing = this.resolveMusicPricing(nextAccessType, {
      unlockPrice: dto.unlockPrice,
      originalUnlockPrice: dto.originalUnlockPrice,
      discountPercent: dto.discountPercent,
    }, {
      originalUnlockPrice: existing.originalUnlockPrice,
      discountPercent: existing.discountPercent,
      unlockPrice: existing.unlockPrice,
    });

    const nextPlaylistTrackIds = dto.playlistTrackIds === undefined
      ? this.parsePlaylistTrackIds(existing.playlistTrackIds)
      : this.normalizeMusicIdArray(dto.playlistTrackIds);

    const playlistTrackAccess = this.normalizePlaylistTrackAccessInput(dto.playlistTrackAccess, nextPlaylistTrackIds);

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

    if (nextContentType === MusicContentType.podcast && !nextAudioUrl && !existing.audioUrl) {
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
      ...(dto.accessType !== undefined ? { accessType: nextAccessType } : {}),
      ...(dto.accessType !== undefined || dto.unlockPrice !== undefined || dto.originalUnlockPrice !== undefined || dto.discountPercent !== undefined
        ? {
          originalUnlockPrice: nextPricing.originalUnlockPrice,
          discountPercent: nextPricing.discountPercent,
          unlockPrice: nextPricing.unlockPrice,
        }
        : {}),
      ...(dto.introEnabled !== undefined ? { introEnabled: dto.introEnabled } : {}),
      ...(dto.playlistTrackIds !== undefined || nextContentType === MusicContentType.playlist || existing.contentType === MusicContentType.playlist
        ? { playlistTrackIds: nextContentType === MusicContentType.playlist ? nextPlaylistTrackIds : [] }
        : {}),
      ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      if (nextContentType === MusicContentType.playlist && playlistTrackAccess.size) {
        await this.applyPlaylistTrackAccessConfig(tx, resolvedPlaylistTracks, playlistTrackAccess);
      }

      return tx.music.update({
        where: { id },
        data,
      });
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
            contentType: { in: [MusicContentType.single, MusicContentType.podcast] },
          },
          select: {
            id: true,
            slug: true,
            title: true,
            artist: true,
            accessType: true,
            originalUnlockPrice: true,
            discountPercent: true,
            unlockPrice: true,
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
          accessType: item.accessType,
          originalUnlockPrice: item.originalUnlockPrice,
          discountPercent: item.discountPercent,
          unlockPrice: item.unlockPrice,
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

  private normalizePlaylistTrackAccessInput(
    value: PlaylistTrackAccessInput[] | undefined,
    playlistTrackIds: string[],
  ): Map<string, { accessType: MusicAccessType; unlockPrice: number }> {
    const normalizedIds = this.normalizeMusicIdArray(playlistTrackIds);
    const allowedIds = new Set(normalizedIds);

    if (!value?.length || !allowedIds.size) {
      return new Map();
    }

    const result = new Map<string, { accessType: MusicAccessType; unlockPrice: number }>();

    value.forEach((item, index) => {
      const trackId = typeof item.trackId === 'string' ? item.trackId.trim() : '';
      if (!trackId) {
        throw new BadRequestException(`playlistTrackAccess[${index}].trackId is required.`);
      }

      if (!allowedIds.has(trackId)) {
        throw new BadRequestException(`playlistTrackAccess contains trackId not included in playlistTrackIds: ${trackId}`);
      }

      const accessType = this.normalizeAccessType(item.accessType);
      const unlockPrice = accessType === MusicAccessType.free
        ? 0
        : this.normalizeUnlockPrice(item.unlockPrice, accessType);

      result.set(trackId, {
        accessType,
        unlockPrice,
      });
    });

    return result;
  }

  private async applyPlaylistTrackAccessConfig(
    tx: Prisma.TransactionClient,
    resolvedPlaylistTracks: PlaylistTrackSummary[],
    accessConfig: Map<string, { accessType: MusicAccessType; unlockPrice: number }>,
  ) {
    if (!accessConfig.size || !resolvedPlaylistTracks.length) return;

    const updates = resolvedPlaylistTracks
      .map((track) => {
        const config = accessConfig.get(track.id);
        if (!config) return null;

        if (
          track.accessType === config.accessType
          && track.unlockPrice === config.unlockPrice
          && (track.originalUnlockPrice ?? config.unlockPrice) === config.unlockPrice
          && track.discountPercent === 0
        ) {
          return null;
        }

        return tx.music.update({
          where: { id: track.id },
          data: {
            accessType: config.accessType,
            originalUnlockPrice: config.accessType === MusicAccessType.vip ? config.unlockPrice : null,
            discountPercent: 0,
            unlockPrice: config.unlockPrice,
          },
        });
      })
      .filter((item): item is ReturnType<typeof tx.music.update> => Boolean(item));

    if (!updates.length) return;
    await Promise.all(updates);
  }

  private normalizeContentType(value: string | undefined): MusicContentType {
    if (value === 'playlist') return MusicContentType.playlist;
    if (value === 'podcast') return MusicContentType.podcast;
    return MusicContentType.single;
  }

  private normalizeAccessType(value: string | undefined): MusicAccessType {
    return value === 'vip' ? MusicAccessType.vip : MusicAccessType.free;
  }

  private normalizeUnlockPrice(value: number | undefined, accessType: MusicAccessType): number {
    if (accessType === MusicAccessType.free) return 0;

    const next = typeof value === 'number' ? Math.floor(value) : 0;
    if (!Number.isFinite(next) || next < 0) {
      throw new BadRequestException('unlockPrice must be a non-negative number.');
    }

    if (next <= 0) {
      throw new BadRequestException('unlockPrice is required when accessType is vip.');
    }

    return next;
  }

  private normalizeDiscountPercent(value: number | undefined): number {
    const next = typeof value === 'number' ? Math.floor(value) : 0;

    if (!Number.isFinite(next) || next < 0 || next > 99) {
      throw new BadRequestException('discountPercent must be an integer between 0 and 99.');
    }

    return next;
  }

  private computeDiscountedPrice(originalUnlockPrice: number, discountPercent: number): number {
    if (discountPercent <= 0) return originalUnlockPrice;

    const discounted = Math.floor((originalUnlockPrice * (100 - discountPercent)) / 100);
    return Math.max(1, discounted);
  }

  private resolveMusicPricing(
    accessType: MusicAccessType,
    input: {
      unlockPrice?: number;
      originalUnlockPrice?: number;
      discountPercent?: number;
    },
    fallback?: {
      originalUnlockPrice: number | null;
      discountPercent: number;
      unlockPrice: number;
    },
  ): {
    originalUnlockPrice: number | null;
    discountPercent: number;
    unlockPrice: number;
  } {
    if (accessType === MusicAccessType.free) {
      return {
        originalUnlockPrice: null,
        discountPercent: 0,
        unlockPrice: 0,
      };
    }

    const fallbackOriginal = typeof fallback?.originalUnlockPrice === 'number'
      ? fallback.originalUnlockPrice
      : (typeof fallback?.unlockPrice === 'number' ? fallback.unlockPrice : 0);

    const originalSource = input.originalUnlockPrice !== undefined
      ? input.originalUnlockPrice
      : (input.unlockPrice !== undefined ? input.unlockPrice : fallbackOriginal);

    const originalUnlockPrice = this.normalizeUnlockPrice(originalSource, MusicAccessType.vip);

    const discountPercent = input.discountPercent !== undefined
      ? this.normalizeDiscountPercent(input.discountPercent)
      : this.normalizeDiscountPercent(fallback?.discountPercent);

    return {
      originalUnlockPrice,
      discountPercent,
      unlockPrice: this.computeDiscountedPrice(originalUnlockPrice, discountPercent),
    };
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
        contentType: { in: [MusicContentType.single, MusicContentType.podcast] },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        artist: true,
        accessType: true,
        originalUnlockPrice: true,
        discountPercent: true,
        unlockPrice: true,
        thumbnailUrl: true,
        audioUrl: true,
        audioDuration: true,
        playCount: true,
        likeCount: true,
        commentCount: true,
      },
    });

    if (rows.length !== normalizedIds.length) {
      throw new BadRequestException('playlistTrackIds contains invalid or unsupported track IDs.');
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
        accessType: item.accessType,
        originalUnlockPrice: item.originalUnlockPrice,
        discountPercent: item.discountPercent,
        unlockPrice: item.unlockPrice,
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
