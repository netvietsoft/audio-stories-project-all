import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';

@Injectable()
export class AuthorsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        return this.prisma.author.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { stories: true },
                },
            },
        });
    }

    async findOne(id: string) {
        const author = await this.prisma.author.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { stories: true },
                },
            },
        });

        if (!author) {
            throw new NotFoundException(`Author with ID ${id} not found`);
        }

        return author;
    }

    async create(data: CreateAuthorDto) {
        return this.prisma.author.create({
            data,
        });
    }

    async update(id: string, data: UpdateAuthorDto) {
        await this.findOne(id);

        return this.prisma.author.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        await this.findOne(id);

        return this.prisma.author.delete({
            where: { id },
        });
    }
}
