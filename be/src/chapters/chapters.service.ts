import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { CreateStandaloneChapterDto } from './dto/create-standalone-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ChapterQueryDto } from './dto/chapter-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChaptersService {
    constructor(private readonly prisma: PrismaService) { }

    private normalizeAudioPayload<T extends { r2AudioUrl?: string; audioUrl?: string; thumbnailUrl?: string }>(data: T) {
        const { audioUrl, ...rest } = data;
        return {
            ...rest,
            ...(typeof audioUrl !== 'undefined' ? { r2AudioUrl: audioUrl } : {}),
        };
    }

    async findAllByStory(storyId: string) {
        return this.prisma.chapter.findMany({
            where: { storyId, deletedAt: null },
            orderBy: { chapterNumber: 'asc' },
        });
    }

    async findAllGlobal(query: ChapterQueryDto) {
        const { page = 1, limit = 20, search, accessType, storyId } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.ChapterWhereInput = {
            deletedAt: null,
            ...(search
                ? {
                    OR: [
                        { title: { contains: search } },
                    ],
                }
                : {}),
            ...(accessType ? { accessType } : {}),
            ...(storyId ? { storyId } : {}),
        };

        const [chapters, total] = await Promise.all([
            this.prisma.chapter.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    story: {
                        select: { title: true },
                    },
                },
            }),
            this.prisma.chapter.count({ where }),
        ]);

        return {
            data: chapters,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: string) {
        const chapter = await this.prisma.chapter.findUnique({
            where: { id },
        });

        if (!chapter || chapter.deletedAt) {
            throw new NotFoundException(`Chapter with ID ${id} not found`);
        }

        return chapter;
    }

    async create(storyId: string, data: CreateChapterDto) {
        // Check if story exists
        const story = await this.prisma.story.findUnique({ where: { id: storyId } });
        if (!story) throw new NotFoundException('Story not found');

        console.log('Creating chapter with data:', data);
        const normalizedData = this.normalizeAudioPayload(data);
        console.log('Normalized data:', normalizedData);

        const [chapter] = await this.prisma.$transaction([
            this.prisma.chapter.create({
                data: {
                    ...normalizedData,
                    storyId,
                },
            }),
            this.prisma.story.update({
                where: { id: storyId },
                data: { totalChapters: { increment: 1 } },
            }),
        ]);

        return chapter;
    }

    async createStandalone(data: CreateStandaloneChapterDto) {
        const { storyId, ...chapterData } = data;

        return this.prisma.chapter.create({
            data: {
                ...this.normalizeAudioPayload(chapterData),
                storyId,
            },
        });
    }

    async update(id: string, data: UpdateChapterDto) {
        await this.findOne(id);

        console.log('Updating chapter with data:', data);
        const normalizedData = this.normalizeAudioPayload(data);
        console.log('Normalized data:', normalizedData);

        return this.prisma.chapter.update({
            where: { id },
            data: normalizedData,
        });
    }

    async remove(id: string) {
        const chapter = await this.findOne(id);

        // Soft delete and decrement totalChapters
        const updates: any[] = [
            this.prisma.chapter.update({
                where: { id },
                data: { deletedAt: new Date() },
            })
        ];

        if (chapter.storyId) {
            updates.push(
                this.prisma.story.update({
                    where: { id: chapter.storyId },
                    data: { totalChapters: { decrement: 1 } },
                })
            );
        }

        const [updatedChapter] = await this.prisma.$transaction(updates);

        return updatedChapter;
    }
}
