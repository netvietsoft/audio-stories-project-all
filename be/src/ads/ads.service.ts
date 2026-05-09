import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { ActiveAdsQueryDto } from './dto/active-ads-query.dto';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

type FindAllAdminQuery = {
  title?: string;
  partnerName?: string;
  language?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  routeType?: number;
};

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

  private extractYoutubeId(value?: string | null): string | null {
    if (!value || typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw) return null;

    const iframeSrcMatch = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    const candidate = iframeSrcMatch?.[1] ?? raw;
    const idPattern = /^[a-zA-Z0-9_-]{11}$/;

    if (idPattern.test(candidate)) return candidate;

    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      if (host.includes('youtu.be')) {
        const id = url.pathname.split('/').filter(Boolean)[0];
        return id && idPattern.test(id) ? id : null;
      }

      if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
        const fromQuery = url.searchParams.get('v');
        if (fromQuery && idPattern.test(fromQuery)) return fromQuery;

        const parts = url.pathname.split('/').filter(Boolean);
        const idx = parts.findIndex((part) => part === 'embed' || part === 'shorts' || part === 'live');
        const fromPath = idx >= 0 ? parts[idx + 1] : null;
        if (fromPath && idPattern.test(fromPath)) return fromPath;
      }
    } catch {
      // fall through to regex
    }

    const matched = candidate.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i);
    return matched?.[1] ?? null;
  }

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async findActive(query: ActiveAdsQueryDto) {
    const baseWhere: any = {
      isActive: true,
      OR: [
        { isGlobal: true },
        ...(query.lang ? [{ language: { key: query.lang } }] : []),
      ],
    };

    if (query.routeType) {
      baseWhere.routeType = query.routeType;
    }

    const rows = await this.prisma.advertisement.findMany({
      where: baseWhere,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        partnerName: true,
        title: true,
        contentType: true,
        imageUrl: true,
        targetUrl: true,
        iframeCode: true,
        youtubeId: true,
        youtubePlayTime: true,
        isForcedRedirect: true,
        isActive: true,
        isGlobal: true,
        routeType: true,
        language: {
          select: { key: true },
        },
      },
    });

    const randomized = this.shuffle(rows).map((row) => ({
      ...row,
      language: typeof row.language === 'object' ? row.language?.key ?? null : row.language ?? null,
    }));
    const safeLimit = query.limit ? Math.max(1, Math.min(query.limit, 20)) : randomized.length;

    return {
      data: randomized.slice(0, safeLimit),
    };
  }

  async findAllAdmin(query: FindAllAdminQuery = {}) {
    const where: Prisma.AdvertisementWhereInput = {
      ...(query.title ? { title: { contains: query.title.trim() } } : {}),
      ...(query.partnerName ? { partnerName: query.partnerName.trim() } : {}),
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
      ...(query.routeType ? { routeType: query.routeType } : {}),
      ...(query.language && query.language !== 'all'
        ? {
            OR: [
              { isGlobal: true },
              { language: { key: query.language } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.AdvertisementOrderByWithRelationInput[] = [];
    if (query.sortBy === 'clickCount') {
      orderBy.push({ clickCount: query.sortOrder === 'asc' ? 'asc' : 'desc' });
    }
    orderBy.push({ isActive: 'desc' }, { updatedAt: 'desc' });

    const rows = await this.prisma.advertisement.findMany({
      where,
      orderBy,
      select: {
        id: true,
        partnerName: true,
        title: true,
        contentType: true,
        imageUrl: true,
        targetUrl: true,
        iframeCode: true,
        youtubeId: true,
        youtubePlayTime: true,
        isForcedRedirect: true,
        clickCount: true,
        isActive: true,
        isGlobal: true,
        routeType: true,
        createdAt: true,
        languageId: true,
        language: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    return {
      data: rows.map((row) => ({
        ...row,
        language: row.language?.key ?? null,
      })),
    };
  }

  async findPartners(routeType?: number) {
    const rows = await this.prisma.advertisement.findMany({
      where: {
        ...(routeType ? { routeType } : {}),
      },
      select: {
        partnerName: true,
      },
      distinct: ['partnerName'],
      orderBy: {
        partnerName: 'asc',
      },
    });

    return {
      data: rows.map((row) => row.partnerName).filter((name) => Boolean(name?.trim())),
    };
  }

  async findOneAdmin(id: string) {
    const row = await this.prisma.advertisement.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Advertisement not found.');
    }
    return row;
  }

  async create(dto: CreateAdDto) {
    const contentType = dto.contentType ?? 'image';
    const isIframe = contentType === 'iframe';
    const isYoutube = contentType === 'youtube';
    const normalizedYoutubeId = isYoutube ? this.extractYoutubeId(dto.youtubeId) || this.extractYoutubeId(dto.iframeCode) : null;

    return this.prisma.advertisement.create({
      data: {
        partnerName: dto.partnerName.trim(),
        title: dto.title.trim(),
        contentType,
        imageUrl: isIframe || isYoutube ? null : (dto.imageUrl || '').trim(),
        targetUrl: isIframe ? null : (dto.targetUrl || '').trim(),
        iframeCode: isIframe ? (dto.iframeCode || '').trim() : null,
        youtubeId: isYoutube ? normalizedYoutubeId : null,
        youtubePlayTime: isYoutube ? (typeof dto.youtubePlayTime === 'number' ? Math.max(1, Math.floor(dto.youtubePlayTime)) : 31) : null,
        isForcedRedirect: dto.isForcedRedirect ?? false,
        languageId: dto.isGlobal ? null : dto.languageId ?? null,
        isGlobal: dto.isGlobal ?? !dto.languageId,
        isActive: dto.isActive ?? true,
        routeType: dto.routeType ?? 1,
      },
    });
  }

  async update(id: string, dto: UpdateAdDto) {
    const existing = await this.prisma.advertisement.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException('Advertisement not found.');
    }

    const current = await this.prisma.advertisement.findUnique({
      where: { id },
      select: { contentType: true },
    });
    const nextContentType = dto.contentType ?? current?.contentType ?? 'image';
    const isIframe = nextContentType === 'iframe';
    const isYoutube = nextContentType === 'youtube';
    const safeTrim = (value?: string | null) => (typeof value === 'string' ? value.trim() : null);
    const nextYoutubePlayTime = dto.youtubePlayTime !== undefined ? Math.max(1, Math.floor(dto.youtubePlayTime)) : undefined;
    const normalizedYoutubeId =
      isYoutube && (dto.youtubeId !== undefined || dto.iframeCode !== undefined)
        ? this.extractYoutubeId(dto.youtubeId) || this.extractYoutubeId(dto.iframeCode)
        : undefined;

    return this.prisma.advertisement.update({
      where: { id },
      data: {
        ...(dto.partnerName !== undefined ? { partnerName: dto.partnerName.trim() } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.contentType !== undefined ? { contentType: dto.contentType } : {}),
        ...(isYoutube
          ? {
              ...(normalizedYoutubeId !== undefined ? { youtubeId: normalizedYoutubeId } : {}),
              ...(nextYoutubePlayTime !== undefined ? { youtubePlayTime: nextYoutubePlayTime } : {}),
            }
          : {
              ...(dto.contentType !== undefined ? { youtubeId: null, youtubePlayTime: null } : {}),
            }),
        ...(dto.isForcedRedirect !== undefined ? { isForcedRedirect: dto.isForcedRedirect } : {}),
        ...(isIframe
          ? {
              imageUrl: null,
              ...(dto.contentType !== undefined ? { targetUrl: null } : {}),
              ...(dto.iframeCode !== undefined ? { iframeCode: safeTrim(dto.iframeCode) } : {}),
            }
          : isYoutube
            ? {
                ...(dto.contentType !== undefined ? { imageUrl: null, iframeCode: null } : {}),
                ...(dto.targetUrl !== undefined ? { targetUrl: safeTrim(dto.targetUrl) } : {}),
              }
            : {
              ...(dto.imageUrl !== undefined ? { imageUrl: safeTrim(dto.imageUrl) } : {}),
              ...(dto.targetUrl !== undefined ? { targetUrl: safeTrim(dto.targetUrl) } : {}),
              ...(dto.contentType !== undefined ? { iframeCode: null } : {}),
            }),
        ...(dto.languageId !== undefined ? { languageId: dto.isGlobal ? null : dto.languageId } : {}),
        ...(dto.isGlobal !== undefined ? { isGlobal: dto.isGlobal } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.routeType !== undefined ? { routeType: dto.routeType } : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.advertisement.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException('Advertisement not found.');
    }

    await this.prisma.advertisement.delete({ where: { id } });

    return { success: true };
  }

  async incrementClick(id: string) {
    const existing = await this.prisma.advertisement.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Advertisement not found.');
    }

    return this.prisma.advertisement.update({
      where: { id },
      data: {
        clickCount: { increment: 1 },
      },
      select: {
        id: true,
        clickCount: true,
      },
    });
  }
}
