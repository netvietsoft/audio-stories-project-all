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

    async findLatest(limit = 10) {
        return this.prisma.chapter.findMany({
            where: { deletedAt: null },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                story: {
                    select: {
                        title: true,
                        slug: true,
                        thumbnailUrl: true,
                        author: {
                            select: { name: true },
                        },
                    },
                },
            },
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
            ...(storyId 
                ? storyId === 'null' 
                    ? { storyId: null } 
                    : { storyId }
                : {}),
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
        const chapter = await this.findOne(id);

        console.log('Updating chapter with data:', data);

        // If storyId is being changed, update totalChapters for both old and new stories
        if (data.storyId !== undefined && data.storyId !== chapter.storyId) {
            // Validate new story exists if storyId is not null
            if (data.storyId) {
                const story = await this.prisma.story.findUnique({ 
                    where: { id: data.storyId } 
                });
                if (!story) {
                    throw new NotFoundException(`Story with ID ${data.storyId} not found`);
                }

                // Find the highest chapter number for the new story (including deleted ones to avoid conflicts)
                const lastChapter = await this.prisma.chapter.findFirst({
                    where: { storyId: data.storyId },
                    orderBy: { chapterNumber: 'desc' },
                });
                
                // Use Math.floor to ensure we get an integer, then add 1
                const nextChapterNumber = lastChapter 
                    ? Math.floor(lastChapter.chapterNumber) + 1 
                    : 1;
                
                console.log('Last chapter found:', lastChapter?.chapterNumber);
                console.log('Auto-assigning chapter number:', nextChapterNumber);
                
                // Update chapter number to avoid unique constraint violation
                data.chapterNumber = nextChapterNumber;
            }

            // Separate storyId and chapterNumber from other fields for normalization
            const { storyId, chapterNumber, ...otherData } = data;
            const normalizedData = Object.keys(otherData).length > 0 
                ? this.normalizeAudioPayload(otherData)
                : {};

            const updateData: any = {
                ...normalizedData,
                storyId,
            };

            // Add chapterNumber if it was set
            if (chapterNumber !== undefined) {
                updateData.chapterNumber = chapterNumber;
            }

            console.log('Final update data:', updateData);

            const updates: any[] = [
                this.prisma.chapter.update({
                    where: { id },
                    data: updateData,
                })
            ];

            // Decrement old story's totalChapters
            if (chapter.storyId) {
                updates.push(
                    this.prisma.story.update({
                        where: { id: chapter.storyId },
                        data: { totalChapters: { decrement: 1 } },
                    })
                );
            }

            // Increment new story's totalChapters
            if (storyId) {
                updates.push(
                    this.prisma.story.update({
                        where: { id: storyId },
                        data: { totalChapters: { increment: 1 } },
                    })
                );
            }

            const [updatedChapter] = await this.prisma.$transaction(updates);
            return updatedChapter;
        }

        // Normal update without storyId change
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
