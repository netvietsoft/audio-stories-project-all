import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { LanguageQueryDto } from './dto/language-query.dto';

@Injectable()
export class LanguagesService {
  constructor(private readonly prisma: PrismaService) {}

  private toBoolean(input?: string): boolean | undefined {
    if (input === undefined) return undefined;
    const normalized = input.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    return undefined;
  }

  async findAll(query: LanguageQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const isAll = query.all === 'true';
    const activeFilter = this.toBoolean(query.active);

    const where: Prisma.LanguageWhereInput = {
      ...(typeof activeFilter === 'boolean' ? { isActive: activeFilter } : {}),
      ...(query.search
        ? {
            OR: [
              { key: { contains: query.search } },
              { name: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.language.count({ where }),
      this.prisma.language.findMany({
        where,
        ...(isAll
          ? {}
          : {
              skip: (page - 1) * limit,
              take: limit,
            }),
        orderBy: [{ displayOrder: 'asc' }, { key: 'asc' }],
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: number) {
    const language = await this.prisma.language.findUnique({
      where: { id },
    });

    if (!language) {
      throw new NotFoundException(`Language with ID ${id} not found`);
    }

    return language;
  }

  async create(data: CreateLanguageDto) {
    const normalizedKey = data.key.trim().toLowerCase();
    const normalizedName = data.name.trim();

    try {
      return await this.prisma.language.create({
        data: {
          key: normalizedKey,
          name: normalizedName,
          isActive: data.isActive ?? true,
          displayOrder: data.displayOrder ?? 0,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(`Language key "${normalizedKey}" already exists`);
      }
      throw error;
    }
  }

  async update(id: number, data: UpdateLanguageDto) {
    await this.findOne(id);

    const payload: Prisma.LanguageUpdateInput = {
      ...(data.key !== undefined ? { key: data.key.trim().toLowerCase() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
    };

    try {
      return await this.prisma.language.update({
        where: { id },
        data: payload,
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Language key already exists');
      }
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.language.delete({
      where: { id },
    });
  }
}
