import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { LabelQueryDto } from './dto/label-query.dto';
import { handlePrismaError } from '@/common/utils/error-handler.util';

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: LabelQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const search = query.search;

    const where: Prisma.LabelWhereInput = search
      ? { OR: [{ name: { contains: search } }, { text: { contains: search } }] }
      : {};

    const [total, data] = await Promise.all([
      this.prisma.label.count({ where }),
      this.prisma.label.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
    ]);

    return { data, meta: { total, page, lastPage: Math.ceil(total / limit) } };
  }

  async findOne(id: number) {
    const label = await this.prisma.label.findUnique({ where: { id } });
    if (!label) throw new NotFoundException(`Label with ID ${id} not found`);
    return label;
  }

  async create(data: CreateLabelDto) {
    try {
      return await this.prisma.label.create({
        data: {
          name: data.name,
          text: data.text,
          color: data.color,
          textColor: data.textColor,
          icon: data.icon,
          defaultDurationDays: data.defaultDurationDays,
        },
      });
    } catch (error) {
      handlePrismaError(error, 'Label');
    }
  }

  async update(id: number, data: UpdateLabelDto) {
    try {
      await this.findOne(id);
      return await this.prisma.label.update({ where: { id }, data });
    } catch (error) {
      handlePrismaError(error, 'Label');
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.label.delete({ where: { id } });
  }

  async bulkRemove(ids: number[]) {
    return this.prisma.label.deleteMany({ where: { id: { in: ids } } });
  }
}
