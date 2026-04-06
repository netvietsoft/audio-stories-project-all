import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CategoriesService {
    constructor(private readonly prisma: PrismaService) { }

    private mapCategoryLanguage<T extends { language?: { key: string } | string | null }>(category: T) {
        return {
            ...category,
            language: typeof category.language === 'object' ? category.language?.key ?? null : category.language ?? null,
        };
    }

    async findAll(query: CategoryQueryDto) {
        const page = query.page || 1;
        const limit = query.limit || 12;
        const search = query.search;
        const language = query.language || 'vi';

        const where: Prisma.CategoryWhereInput = {
            language: {
                key: language,
            },
            ...(search ? {
                OR: [
                    { name: { contains: search } },
                    { slug: { contains: search } },
                ]
            } : {})
        };

        const [total, data] = await Promise.all([
            this.prisma.category.count({ where }),
            this.prisma.category.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    language: {
                        select: {
                            key: true,
                        },
                    },
                    description: true,
                    iconUrl: true,
                    imageUrl: true,
                    createdAt: true,
                    _count: {
                        select: { stories: true },
                    },
                },
            }),
        ]);

        return {
            data: data.map((category) => this.mapCategoryLanguage(category)),
            meta: {
                total,
                page,
                lastPage: Math.ceil(total / limit),
            }
        };
    }

    async findOne(id: number) {
        const category = await this.prisma.category.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                slug: true,
                language: {
                    select: {
                        key: true,
                    },
                },
                description: true,
                iconUrl: true,
                imageUrl: true,
                createdAt: true,
                _count: {
                    select: { stories: true },
                },
            },
        });

        if (!category) {
            throw new NotFoundException(`Category with ID ${id} not found`);
        }

        return this.mapCategoryLanguage(category);
    }

    async create(data: CreateCategoryDto) {
        return this.prisma.category.create({
            data: {
                name: data.name,
                slug: data.slug,
                description: data.description,
                iconUrl: data.iconUrl,
                language: {
                    connect: {
                        key: (data.language || 'vi').trim(),
                    },
                },
            },
        });
    }

    async update(id: number, data: UpdateCategoryDto) {
        await this.findOne(id);

        const { language, ...categoryData } = data;

        return this.prisma.category.update({
            where: { id },
            data: {
                ...categoryData,
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

    async remove(id: number) {
        await this.findOne(id);

        return this.prisma.category.delete({
            where: { id },
        });
    }

    async bulkRemove(ids: number[]) {
        return this.prisma.category.deleteMany({
            where: {
                id: { in: ids },
            },
        });
    }
}
