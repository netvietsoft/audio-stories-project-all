import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UserFeaturesService } from '@/user-features/user-features.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { CreateStandaloneChapterDto } from './dto/create-standalone-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ChapterQueryDto } from './dto/chapter-query.dto';
import { Prisma } from '@prisma/client';
import { handlePrismaError } from '@/common/utils/error-handler.util';

@Injectable()
export class ChaptersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly userFeaturesService: UserFeaturesService,
    ) { }

    private normalizeChapterFlatPayload(data: Record<string, any>) {
        // Remove relation fields that should not be passed as flat values
        const { storyId, language, ...rest } = data;
        return rest;
    }

    async findAllByStory(storyId: string) {
        return this.prisma.chapter.findMany({
            where: { storyId, deletedAt: null },
            orderBy: { chapterNumber: 'asc' },
            select: {
                id: true,
                storyId: true,
                chapterNumber: true,
                title: true,
                description: true,
                thumbnailUrl: true,
                // audioUrl and r2AudioUrl intentionally omitted — use /chapters/:id/audio proxy
                youtubeVideoId: true,
                audioDuration: true,
                accessType: true,
                unlockPrice: true,
                isInteractive: true,
                unlocksAt: true,
                viewCount: true,
                createdAt: true,
                updatedAt: true,
                language: {
                    select: { key: true },
                },
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
            select: {
                id: true,
                storyId: true,
                chapterNumber: true,
                title: true,
                thumbnailUrl: true,
                audioDuration: true,
                // r2AudioUrl intentionally omitted — clients use /chapters/:id/audio proxy
                createdAt: true,
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
                select: {
                    id: true,
                    storyId: true,
                    chapterNumber: true,
                    title: true,
                    description: true,
                    thumbnailUrl: true,
                    youtubeVideoId: true,
                    audioDuration: true,
                    accessType: true,
                    unlockPrice: true,
                    isInteractive: true,
                    unlocksAt: true,
                    viewCount: true,
                    createdAt: true,
                    updatedAt: true,
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

    async findPublicDetail(id: string) {
        const chapter = await this.prisma.chapter.findUnique({
            where: { id },
            select: {
                id: true,
                storyId: true,
                chapterNumber: true,
                title: true,
                description: true,
                content: true,
                thumbnailUrl: true,
                // audioUrl and r2AudioUrl intentionally omitted from public detail.
                // Clients must use GET /chapters/:id/audio (entitlement-checked proxy).
                youtubeVideoId: true,
                audioDuration: true,
                accessType: true,
                unlockPrice: true,
                isInteractive: true,
                unlocksAt: true,
                createdAt: true,
                updatedAt: true,
                variants: {
                    where: { deletedAt: null },
                    orderBy: { orderIndex: 'asc' },
                    select: {
                        id: true,
                        chapterId: true,
                        parentId: true,
                        nextChapterId: true,
                        nextVariantId: true,
                        title: true,
                        description: true,
                        content: true,
                        // audioUrl and r2AudioUrl omitted — clients call /chapters/:id/audio?variantId=...
                        audioDuration: true,
                        unlockPrice: true,
                        orderIndex: true,
                        isDefault: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });

        if (!chapter) {
            throw new NotFoundException(`Chapter with ID ${id} not found`);
        }

        return chapter;
    }

    /**
     * Resolve the playback URL for a chapter (or variant), enforcing entitlement.
     *
     * Access rules:
     *   - accessType === 'free'  → any caller (anonymous or authenticated)
     *   - accessType === 'timed' → free if unlocksAt has passed, else requires VIP
     *   - accessType === 'vip'   → requires vipTier > 0 (non-expired)
     * Additionally, if unlockPrice > 0, user must have a UserUnlockedVariant record.
     *
     * Returns the best available URL (r2AudioUrl preferred over audioUrl).
     */
    async getAudioUrl(
        id: string,
        userId?: string,
        variantId?: string,
    ): Promise<{ url: string }> {
        const chapter = await this.prisma.chapter.findUnique({
            where: { id },
            select: {
                id: true,
                audioUrl: true,
                r2AudioUrl: true,
                accessType: true,
                unlockPrice: true,
                unlocksAt: true,
            },
        });

        if (!chapter) {
            throw new NotFoundException(`Chapter with ID ${id} not found`);
        }

        let variantUnlockPrice = 0;
        let unlockedVariantId: string | undefined;

        const variant = variantId
            ? await this.prisma.chapterVariant.findFirst({
                where: {
                    id: variantId,
                    chapterId: id,
                    deletedAt: null,
                },
                select: {
                    id: true,
                    audioUrl: true,
                    r2AudioUrl: true,
                    unlockPrice: true,
                },
            })
            : null;

        if (variantId && !variant) {
            throw new NotFoundException('Variant not found for this chapter');
        }

        if (variant) {
            variantUnlockPrice = variant.unlockPrice || 0;
            unlockedVariantId = variant.id;
        }

        const url =
            (variant?.r2AudioUrl || variant?.audioUrl) ||
            chapter.r2AudioUrl ||
            chapter.audioUrl;
        if (!url) {
            throw new NotFoundException('No audio available for this chapter');
        }

        // --- Entitlement check ---
        const { accessType, unlockPrice, unlocksAt } = chapter;

        // Free chapter: always accessible
        if (accessType === 'free') {
            return { url };
        }

        // Timed chapter: free once unlocksAt has passed
        if (accessType === 'timed' && unlocksAt && unlocksAt <= new Date()) {
            return { url };
        }

        // All other cases require an authenticated user
        if (!userId) {
            throw new ForbiddenException('Authentication required to access this chapter');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { vipTier: true, vipExpirationDate: true, credits: true },
        });

        const isVip =
            user &&
            (user.vipTier ?? 0) > 0 &&
            (!user.vipExpirationDate || user.vipExpirationDate > new Date());

        if (accessType === 'vip' || accessType === 'timed') {
            if (!isVip) {
                throw new ForbiddenException('VIP membership required to access this chapter');
            }
            return { url };
        }

        // Chapter with unlock price: check if user has unlocked it
        const requiredUnlockPrice = Math.max(unlockPrice || 0, variantUnlockPrice || 0);
        if (requiredUnlockPrice > 0) {
            const unlocked = unlockedVariantId
                ? await this.prisma.userUnlockedVariant.findUnique({
                    where: {
                        userId_variantId: {
                            userId,
                            variantId: unlockedVariantId,
                        },
                    },
                })
                : await this.prisma.userUnlockedVariant.findFirst({
                    where: { userId, variant: { chapterId: id } },
                });
            if (!unlocked && !isVip) {
                throw new ForbiddenException('This chapter must be unlocked before listening');
            }
        }

        return { url };
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
        try {
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
        } catch (error) {
            handlePrismaError(error, 'Chapter');
        }
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
