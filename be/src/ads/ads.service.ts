import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';
import { ActiveAdsQueryDto } from './dto/active-ads-query.dto';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findAllAdmin(lang?: string, routeType?: number) {
    const rows = await this.prisma.advertisement.findMany({
      where: {
        ...(lang && lang !== 'all'
          ? {
            OR: [
              { isGlobal: true },
              { language: { key: lang } },
            ],
          }
          : {}),
        ...(routeType ? { routeType } : {}),
      },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        partnerName: true,
        title: true,
        contentType: true,
        imageUrl: true,
        targetUrl: true,
        iframeCode: true,
        isActive: true,
        isGlobal: true,
        routeType: true,
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

    return this.prisma.advertisement.create({
      data: {
        partnerName: dto.partnerName.trim(),
        title: dto.title.trim(),
        contentType,
        imageUrl: isIframe ? null : (dto.imageUrl || '').trim(),
        targetUrl: isIframe ? null : (dto.targetUrl || '').trim(),
        iframeCode: isIframe ? (dto.iframeCode || '').trim() : null,
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

    return this.prisma.advertisement.update({
      where: { id },
      data: {
        ...(dto.partnerName !== undefined ? { partnerName: dto.partnerName.trim() } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.contentType !== undefined ? { contentType: dto.contentType } : {}),
        ...(isIframe
          ? {
              imageUrl: null,
              targetUrl: null,
              ...(dto.iframeCode !== undefined ? { iframeCode: dto.iframeCode.trim() } : {}),
            }
          : {
              ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl.trim() } : {}),
              ...(dto.targetUrl !== undefined ? { targetUrl: dto.targetUrl.trim() } : {}),
              ...(dto.contentType === 'image' ? { iframeCode: null } : {}),
            }),
        ...(dto.iframeCode !== undefined && !isIframe ? { iframeCode: dto.iframeCode.trim() } : {}),
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
}
