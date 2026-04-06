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
        return data;
    }

    async findAllByStory(storyId: string) {
        return this.prisma.chapter.findMany({
            where: { storyId, deletedAt: null },
            orderBy: { chapterNumber: 'asc' },
            include: {
                _count: {
                    select: { variants: true },
                },
            },
        });
    }

    async findLatest(limit = 10, lang?: string) {
        return this.prisma.chapter.findMany({
            where: { 
                deletedAt: null,
                ...(lang ? { story: { language: { key: lang } } } : {}),
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                language: {
                    select: { key: true },
                },
                story: {
                    select: {
                        title: true,
                        slug: true,
                        language: {
                            select: { key: true },
                        },
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
                    title: { contains: search },
                }
                : {}),
            ...(accessType ? { accessType } : {}),
            ...(storyId 
                ? storyId === 'null' 
                    ? { storyId: null } 
                    : { storyId }
                : {}),
            ...(lang ? { language: { key: lang } } : {}),
        };

        const [chapters, total] = await Promise.all([
            this.prisma.chapter.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    language: {
                        select: { key: true },
                    },
                    story: {
                        select: { title: true, language: { select: { key: true } } },
                    },
                },
            }),
            this.prisma.chapter.count({ where }),
        ]);

        return {
            data: chapters.map((chapter) => ({
                ...chapter,
                language: typeof chapter.language === 'object' ? chapter.language?.key ?? null : chapter.language,
                story: chapter.story
                    ? {
                        ...chapter.story,
                        language: typeof chapter.story.language === 'object' ? chapter.story.language?.key ?? null : chapter.story.language,
                    }
                    : chapter.story,
            })),
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
        const createData: Prisma.ChapterCreateInput = {
            ...(normalizedData as Prisma.ChapterCreateInput),
            story: {
                connect: { id: storyId },
            },
            language: {
                connect: {
                    key: ((data as CreateChapterDto & { language?: string }).language || 'vi').trim(),
                },
            },
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
        const createData: Prisma.ChapterCreateInput = {
            ...(normalizedData as Prisma.ChapterCreateInput),
            ...(storyId ? { story: { connect: { id: storyId } } } : {}),
            language: {
                connect: {
                    key: ((chapterData as CreateStandaloneChapterDto & { language?: string }).language || 'vi').trim(),
                },
            },
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
            data.title !== undefined ||
            data.description !== undefined ||
            data.content !== undefined ||
            data.r2AudioUrl !== undefined ||
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
            const { storyId, chapterNumber, language, ...otherData } = data;
            const normalizedData = Object.keys(otherData).length > 0 
                ? this.normalizeChapterFlatPayload(otherData as any)
                : {};

            const updateData: any = {
                ...normalizedData,
                ...(storyId !== undefined ? {
                    story: storyId ? { connect: { id: storyId } } : { disconnect: true },
                } : {}),
                ...(language ? { language: { connect: { key: language } } } : {}),
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
