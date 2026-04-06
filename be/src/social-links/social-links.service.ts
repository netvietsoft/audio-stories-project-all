import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSocialLinkDto } from './dto/create-social-link.dto';
import { UpdateSocialLinkDto } from './dto/update-social-link.dto';

@Injectable()
export class SocialLinksService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateSocialLinkDto) {
    return this.prisma.socialLink.create({
      data: createDto,
    });
  }

  async findAll() {
    return this.prisma.socialLink.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async findAllAdmin() {
    return this.prisma.socialLink.findMany({
      orderBy: { orderIndex: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.socialLink.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateDto: UpdateSocialLinkDto) {
    return this.prisma.socialLink.update({
      where: { id },
      data: updateDto,
    });
  }

  async remove(id: string) {
    return this.prisma.socialLink.delete({
      where: { id },
    });
  }
}
