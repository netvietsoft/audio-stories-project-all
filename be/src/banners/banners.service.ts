import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';
import { BannerQueryDto } from './dto/banner-query.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  private buildLocalizedPayload<T extends { titleVi?: string; titleEn?: string; subtitleVi?: string; subtitleEn?: string }>(
    payload: T,
  ) {
    const titleVi = payload.titleVi?.trim();
    const titleEn = payload.titleEn?.trim();

    if (!titleVi && !titleEn) {
      throw new BadRequestException('Banner must have at least one title (titleVi or titleEn).');
    }

    return {
      titleVi: titleVi || titleEn || '',
      titleEn: titleEn || titleVi || '',
      subtitleVi: payload.subtitleVi?.trim() || null,
      subtitleEn: payload.subtitleEn?.trim() || null,
    };
  }

  private async ensureStoryExists(storyId?: string) {
    if (!storyId) return;

    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true },
    });

    if (!story) {
      throw new BadRequestException('Story not found for provided storyId.');
    }
  }

  async findPublic(query: BannerQueryDto) {
    const lang = query.lang === 'en' ? 'en' : 'vi';

    const rows = await this.prisma.heroBanner.findMany({
      where: {
        isActive: query.active ?? true,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        titleVi: true,
        titleEn: true,
        subtitleVi: true,
        subtitleEn: true,
        imageUrl: true,
        targetUrl: true,
        storyId: true,
        order: true,
        isActive: true,
        story: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },
      },
    });

    return {
      data: rows.map((item) => ({
        ...item,
        title: lang === 'en' ? item.titleEn || item.titleVi : item.titleVi || item.titleEn,
        subtitle: lang === 'en' ? item.subtitleEn || item.subtitleVi : item.subtitleVi || item.subtitleEn,
      })),
    };
  }

  async findAllAdmin() {
    const rows = await this.prisma.heroBanner.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      include: {
        story: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },
      },
    });

    return { data: rows };
  }

  async findOneAdmin(id: string) {
    const banner = await this.prisma.heroBanner.findUnique({
      where: { id },
      include: {
        story: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },
      },
    });

    if (!banner) {
      throw new NotFoundException('Banner not found.');
    }

    return banner;
  }

  async create(dto: CreateBannerDto) {
    await this.ensureStoryExists(dto.storyId);

    const localized = this.buildLocalizedPayload(dto);

    const banner = await this.prisma.heroBanner.create({
      data: {
        ...localized,
        imageUrl: dto.imageUrl,
        targetUrl: dto.targetUrl,
        storyId: dto.storyId || null,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        story: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },
      },
    });

    return banner;
  }

  async update(id: string, dto: UpdateBannerDto) {
    const existing = await this.prisma.heroBanner.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Banner not found.');
    }

    if (dto.storyId !== undefined) {
      await this.ensureStoryExists(dto.storyId);
    }

    const nextTitleVi = dto.titleVi === undefined ? existing.titleVi : dto.titleVi;
    const nextTitleEn = dto.titleEn === undefined ? existing.titleEn : dto.titleEn;
    const localized = this.buildLocalizedPayload({
      titleVi: nextTitleVi,
      titleEn: nextTitleEn,
      subtitleVi: dto.subtitleVi === undefined ? existing.subtitleVi || undefined : dto.subtitleVi,
      subtitleEn: dto.subtitleEn === undefined ? existing.subtitleEn || undefined : dto.subtitleEn,
    });

    return this.prisma.heroBanner.update({
      where: { id },
      data: {
        ...localized,
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.targetUrl !== undefined ? { targetUrl: dto.targetUrl } : {}),
        ...(dto.storyId !== undefined ? { storyId: dto.storyId || null } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        story: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.heroBanner.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      throw new NotFoundException('Banner not found.');
    }

    await this.prisma.heroBanner.delete({ where: { id } });

    return { success: true };
  }
}
