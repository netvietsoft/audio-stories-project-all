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
    const rows = await this.prisma.advertisement.findMany({
      where: { isActive: true },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        partnerName: true,
        title: true,
        imageUrl: true,
        targetUrl: true,
        isActive: true,
      },
    });

    const randomized = this.shuffle(rows);
    const safeLimit = query.limit ? Math.max(1, Math.min(query.limit, 20)) : randomized.length;

    return {
      data: randomized.slice(0, safeLimit),
    };
  }

  async findAllAdmin() {
    const rows = await this.prisma.advertisement.findMany({
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });

    return { data: rows };
  }

  async findOneAdmin(id: string) {
    const row = await this.prisma.advertisement.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Advertisement not found.');
    }
    return row;
  }

  async create(dto: CreateAdDto) {
    return this.prisma.advertisement.create({
      data: {
        partnerName: dto.partnerName.trim(),
        title: dto.title.trim(),
        imageUrl: dto.imageUrl.trim(),
        targetUrl: dto.targetUrl.trim(),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateAdDto) {
    const existing = await this.prisma.advertisement.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException('Advertisement not found.');
    }

    return this.prisma.advertisement.update({
      where: { id },
      data: {
        ...(dto.partnerName !== undefined ? { partnerName: dto.partnerName.trim() } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl.trim() } : {}),
        ...(dto.targetUrl !== undefined ? { targetUrl: dto.targetUrl.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
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
