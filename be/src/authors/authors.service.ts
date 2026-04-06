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
                language: {
                    select: { key: true },
                },
                _count: {
                    select: { stories: true },
                },
            },
        }).then((rows) => rows.map((author) => ({
            ...author,
            language: typeof author.language === 'object' ? author.language?.key ?? null : author.language,
        })));
    }

    async findOne(id: string) {
        const author = await this.prisma.author.findUnique({
            where: { id },
            include: {
                language: {
                    select: { key: true },
                },
                _count: {
                    select: { stories: true },
                },
            },
        });

        if (!author) {
            throw new NotFoundException(`Author with ID ${id} not found`);
        }

        return {
            ...author,
            language: typeof author.language === 'object' ? author.language?.key ?? null : author.language,
        };
    }

    async create(data: CreateAuthorDto) {
        const { language, ...authorData } = data;
        return this.prisma.author.create({
            data: {
                ...authorData,
                language: {
                    connect: {
                        key: (language || 'vi').trim(),
                    },
                },
            },
        });
    }

    async update(id: string, data: UpdateAuthorDto) {
        await this.findOne(id);

        const { language, ...authorData } = data;

        return this.prisma.author.update({
            where: { id },
            data: {
                ...authorData,
                ...(language ? {
                    language: {
                        connect: {
                            key: language.trim(),
                        },
                    },
                } : {}),
            },
        });
    }

    async remove(id: string) {
        await this.findOne(id);

        return this.prisma.author.delete({
            where: { id },
        });
    }
}
