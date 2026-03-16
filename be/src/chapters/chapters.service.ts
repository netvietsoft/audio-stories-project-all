import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UserFeaturesService } from '@/user-features/user-features.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { CreateStandaloneChapterDto } from './dto/create-standalone-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ChapterQueryDto } from './dto/chapter-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChaptersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly userFeaturesService: UserFeaturesService,
    ) { }

    private normalizeChapterFlatPayload(data: Record<string, any>) {
        const next: Record<string, any> = { ...data };

        next.title = next.titleVi || next.titleEn || next.title || '';
        next.description = next.descriptionVi || next.descriptionEn || next.description || null;
        next.content = next.contentVi || next.contentEn || next.content || null;
        next.r2AudioUrl = next.audioUrlVi || next.audioUrlEn || next.r2AudioUrl || null;

        return next;
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
        const { page = 1, limit = 20, search, accessType, storyId, lang } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.ChapterWhereInput = {
            deletedAt: null,
            ...(search
                ? {
                    OR: [
                        { title: { contains: search } },
                        { titleVi: { contains: search } },
                        { titleEn: { contains: search } },
                    ],
                }
                : {}),
            ...(accessType ? { accessType } : {}),
            ...(storyId 
                ? storyId === 'null' 
                    ? { storyId: null } 
                    : { storyId }
                : {}),
            ...(lang ? { language: lang } : {}),
        };

        const [chapters, total] = await Promise.all([
            this.prisma.chapter.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    story: {
                        select: { title: true, titleVi: true, titleEn: true },
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
        const normalizedData = this.normalizeChapterFlatPayload(data as any);
        const createData: Prisma.ChapterUncheckedCreateInput = {
            ...(normalizedData as Prisma.ChapterUncheckedCreateInput),
            storyId,
        };
        console.log('Normalized data:', normalizedData);

        const [chapter] = await this.prisma.$transaction([
            this.prisma.chapter.create({
                data: createData,
            }),
            this.prisma.story.update({
                where: { id: storyId },
                data: { totalChapters: { increment: 1 } },
            }),
        ]);

        await this.userFeaturesService.notifyStoryUpdated(storyId, chapter.id, 'new_chapter');

        return chapter;
    }

    async createStandalone(data: CreateStandaloneChapterDto) {
        const { storyId, ...chapterData } = data;

        const normalizedData = this.normalizeChapterFlatPayload(chapterData as any);
        const createData: Prisma.ChapterUncheckedCreateInput = {
            ...(normalizedData as Prisma.ChapterUncheckedCreateInput),
            ...(storyId ? { storyId } : {}),
        };

        const chapter = await this.prisma.chapter.create({
            data: createData,
        });

        if (chapter.storyId) {
            await this.userFeaturesService.notifyStoryUpdated(chapter.storyId, chapter.id, 'new_chapter');
        }

        return chapter;
    }

    async update(id: string, data: UpdateChapterDto) {
        const chapter = await this.findOne(id);
        const shouldNotifyUpdate =
            data.storyId !== undefined ||
            data.titleVi !== undefined ||
            data.titleEn !== undefined ||
            data.descriptionVi !== undefined ||
            data.descriptionEn !== undefined ||
            data.contentVi !== undefined ||
            data.contentEn !== undefined ||
            data.r2AudioUrl !== undefined ||
            data.audioUrlVi !== undefined ||
            data.audioUrlEn !== undefined ||
            data.thumbnailUrl !== undefined;

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
                ? this.normalizeChapterFlatPayload(otherData as any)
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

            if (updatedChapter.storyId && shouldNotifyUpdate) {
                const updateType = chapter.storyId && chapter.storyId === updatedChapter.storyId
                    ? 'chapter_updated'
                    : 'new_chapter';
                await this.userFeaturesService.notifyStoryUpdated(updatedChapter.storyId, updatedChapter.id, updateType);
            }

            return updatedChapter;
        }

        // Normal update without storyId change
        const normalizedData = this.normalizeChapterFlatPayload(data as any);
        console.log('Normalized data:', normalizedData);

        const updatedChapter = await this.prisma.chapter.update({
            where: { id },
            data: normalizedData,
        });

        if (updatedChapter.storyId && shouldNotifyUpdate) {
            await this.userFeaturesService.notifyStoryUpdated(updatedChapter.storyId, updatedChapter.id, 'chapter_updated');
        }

        return updatedChapter;
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
