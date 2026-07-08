import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UserFeaturesService } from '@/user-features/user-features.service';
import { HlsQueueService } from '@/hls/hls-queue.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { CreateStandaloneChapterDto } from './dto/create-standalone-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ChapterQueryDto } from './dto/chapter-query.dto';
import { Prisma } from '@prisma/client';
import { handlePrismaError } from '@/common/utils/error-handler.util';
import { buildTimingJson } from './timing/build-timing';

@Injectable()
export class ChaptersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userFeaturesService: UserFeaturesService,
    private readonly hlsQueue: HlsQueueService,
  ) {}

  /** Enqueue chapter-level HLS transcode when the chapter has audio (after commit). */
  private async registerChapterHls(chapter: {
    id: string;
    audioUrl?: string | null;
    r2AudioUrl?: string | null;
  }) {
    await this.hlsQueue.registerAsset(
      'chapter',
      chapter.id,
      chapter.r2AudioUrl ?? chapter.audioUrl,
    );
  }

  private normalizeChapterFlatPayload(data: Record<string, any>) {
    // Remove relation fields that should not be passed as flat values
    const { storyId, language, unlocksAt, ...rest } = data;
    const normalizedUnlocksAt =
      unlocksAt === '' || unlocksAt === null || typeof unlocksAt === 'undefined'
        ? undefined
        : new Date(unlocksAt);

    if (typeof normalizedUnlocksAt !== 'undefined') {
      return {
        ...rest,
        unlocksAt: normalizedUnlocksAt,
      };
    }
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
        discountPercent: true,
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
          discountPercent: true,
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
        language:
          typeof chapter.language === 'object'
            ? (chapter.language?.key ?? null)
            : chapter.language,
        story: chapter.story
          ? {
              ...chapter.story,
              language:
                typeof chapter.story.language === 'object'
                  ? (chapter.story.language?.key ?? null)
                  : chapter.story.language,
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
        discountPercent: true,
        isInteractive: true,
        unlocksAt: true,
        createdAt: true,
        updatedAt: true,
        timingJson: true,
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

    // Gắn hlsUrl (HlsAsset.playlistUrl, status='ready') cho chapter + từng variant.
    // null nếu HLS chưa sẵn sàng. Không che theo quyền: segment AES-128, khoá gated qua /hls/:type/:id/key.
    const variantIds = (chapter.variants ?? []).map((v) => v.id);
    const [chapterMap, variantMap] = await Promise.all([
      this.loadReadyHls('chapter', [chapter.id]),
      this.loadReadyHls('variant', variantIds),
    ]);

    return {
      ...chapter,
      hlsUrl: chapterMap.get(chapter.id) ?? null,
      timing: chapter.timingJson ?? null,
      variants: (chapter.variants ?? []).map((variant) => ({
        ...variant,
        hlsUrl: variantMap.get(variant.id) ?? null,
      })),
    };
  }

  /** Map of assetId → ready HLS playlist URL cho assetType cho trước (tránh N+1). */
  private async loadReadyHls(
    assetType: 'chapter' | 'variant',
    ids: string[],
  ): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const assets = await this.prisma.hlsAsset.findMany({
      where: { assetType, assetId: { in: ids }, status: 'ready' },
      select: { assetId: true, playlistUrl: true },
    });
    return new Map(
      assets
        .filter(
          (a): a is { assetId: string; playlistUrl: string } => !!a.playlistUrl,
        )
        .map((a) => [a.assetId, a.playlistUrl]),
    );
  }

  async getUnlockStatus(chapterId: string, userId?: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        storyId: true,
        accessType: true,
        unlocksAt: true,
      },
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter with ID ${chapterId} not found`);
    }

    if (chapter.accessType === 'free') {
      return { isUnlocked: true, unlockSource: 'FREE', isTimedFree: false };
    }

    if (
      chapter.accessType === 'timed' &&
      chapter.unlocksAt &&
      chapter.unlocksAt <= new Date()
    ) {
      return { isUnlocked: true, unlockSource: 'FREE', isTimedFree: true };
    }

    if (!userId) {
      return { isUnlocked: false, unlockSource: null, isTimedFree: false };
    }

    const [user, storyUnlock, chapterUnlock] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { vipTier: true, vipExpirationDate: true },
      }),
      chapter.storyId
        ? this.prisma.userStoryUnlock.findUnique({
            where: { userId_storyId: { userId, storyId: chapter.storyId } },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.userChapterUnlock.findUnique({
        where: { userId_chapterId: { userId, chapterId } },
        select: { unlockType: true },
      }),
    ]);

    const isVip =
      !!user &&
      (user.vipTier ?? 0) > 0 &&
      (!user.vipExpirationDate || user.vipExpirationDate > new Date());

    if (isVip) {
      return { isUnlocked: true, unlockSource: 'VIP', isTimedFree: false };
    }

    if (storyUnlock) {
      return {
        isUnlocked: true,
        unlockSource: 'PULSE_STORY',
        isTimedFree: false,
      };
    }

    if (chapterUnlock) {
      return {
        isUnlocked: true,
        unlockSource: `CHAPTER_${chapterUnlock.unlockType}`,
        isTimedFree: false,
      };
    }

    return { isUnlocked: false, unlockSource: null, isTimedFree: false };
  }

  async unlockByPulse(chapterId: string, userId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        storyId: true,
        title: true,
        accessType: true,
        unlockPrice: true,
        discountPercent: true,
        unlocksAt: true,
      },
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter with ID ${chapterId} not found`);
    }

    if (chapter.accessType === 'free' || chapter.accessType === 'ads') {
      throw new BadRequestException(
        'Chapter is not configured for pulse unlock',
      );
    }

    if (
      chapter.accessType === 'timed' &&
      chapter.unlocksAt &&
      chapter.unlocksAt <= new Date()
    ) {
      return {
        success: true,
        alreadyUnlocked: true,
        charged: 0,
        reason: 'timed_free',
      };
    }

    const [user, storyUnlock, existingChapterUnlock] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          pulseBalance: true,
          vipTier: true,
          vipExpirationDate: true,
        },
      }),
      chapter.storyId
        ? this.prisma.userStoryUnlock.findUnique({
            where: { userId_storyId: { userId, storyId: chapter.storyId } },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.userChapterUnlock.findUnique({
        where: { userId_chapterId: { userId, chapterId } },
        select: { id: true, unlockType: true },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isVip =
      (user.vipTier ?? 0) > 0 &&
      (!user.vipExpirationDate || user.vipExpirationDate > new Date());

    if (isVip) {
      await this.prisma.userChapterUnlock.upsert({
        where: { userId_chapterId: { userId, chapterId } },
        create: {
          userId,
          chapterId,
          pulseAmount: 0,
          unlockType: chapter.accessType === 'vip' ? 'VIP' : 'TIMED',
        },
        update: {},
      });
      return {
        success: true,
        alreadyUnlocked: true,
        charged: 0,
        reason: 'vip',
      };
    }

    if (storyUnlock) {
      return {
        success: true,
        alreadyUnlocked: true,
        charged: 0,
        reason: 'story_unlocked',
      };
    }

    if (existingChapterUnlock) {
      return {
        success: true,
        alreadyUnlocked: true,
        charged: 0,
        reason: `chapter_${existingChapterUnlock.unlockType}`,
      };
    }

    const basePrice = Math.max(0, Math.floor(Number(chapter.unlockPrice || 0)));
    if (basePrice <= 0) {
      throw new BadRequestException('Chapter unlock price is not configured');
    }

    const safeDiscount = Math.max(
      0,
      Math.min(100, Math.floor(Number(chapter.discountPercent || 0))),
    );
    const finalPrice = Math.max(
      0,
      Math.floor((basePrice * (100 - safeDiscount)) / 100),
    );

    if (user.pulseBalance < finalPrice) {
      throw new BadRequestException('Insufficient Pulse');
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: userId },
        data: { pulseBalance: { decrement: finalPrice } },
        select: { pulseBalance: true },
      });

      await tx.userChapterUnlock.upsert({
        where: { userId_chapterId: { userId, chapterId } },
        create: {
          userId,
          chapterId,
          pulseAmount: finalPrice,
          unlockType: 'PULSE',
        },
        update: { pulseAmount: finalPrice, unlockType: 'PULSE' },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'spend',
          pulseAmount: -finalPrice,
          pulseBalanceBefore: user.pulseBalance,
          pulseBalanceAfter: nextUser.pulseBalance,
          referenceId: chapterId,
          description: `Mở khóa chương: ${chapter.title || chapter.id}`,
        },
      });

      return nextUser;
    });

    return {
      success: true,
      charged: finalPrice,
      basePrice,
      discountPercent: safeDiscount,
      pulseBalance: updatedUser.pulseBalance,
    };
  }

  async unlockByAd(chapterId: string, adId?: string, userId?: string | null) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, accessType: true, unlockAdId: true },
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter with ID ${chapterId} not found`);
    }

    // In production data, ad-unlocked chapters are identified by unlockAdId.
    // accessType may still be persisted as 'timed' on older schemas.
    if (!chapter.unlockAdId && String(chapter.accessType) !== 'ads') {
      throw new BadRequestException(
        'This chapter is not configured for ad-based unlock',
      );
    }

    // If chapter is tied to a specific ad, ensure the provided ad matches
    if (chapter.unlockAdId && adId && chapter.unlockAdId !== adId) {
      throw new BadRequestException(
        'Provided ad does not match chapter unlock configuration',
      );
    }

    // If adId provided, validate ad exists and is active
    if (adId) {
      const ad = await this.prisma.advertisement.findUnique({
        where: { id: adId },
        select: { id: true, isActive: true },
      });
      if (!ad || !ad.isActive) {
        throw new BadRequestException('Invalid or inactive ad');
      }
    }

    // If no user is present, nothing more to record server-side — return success
    if (!userId) {
      return { success: true };
    }

    // Record unlock for the user (upsert)
    await this.prisma.userChapterUnlock.upsert({
      where: { userId_chapterId: { userId, chapterId } },
      create: { userId, chapterId, pulseAmount: 0, unlockType: 'AD' },
      update: {},
    });

    return { success: true };
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
        storyId: true,
        audioUrl: true,
        r2AudioUrl: true,
        accessType: true,
        unlockPrice: true,
        discountPercent: true,
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
      variant?.r2AudioUrl ||
      variant?.audioUrl ||
      chapter.r2AudioUrl ||
      chapter.audioUrl;
    if (!url) {
      throw new NotFoundException('No audio available for this chapter');
    }

    // --- Entitlement check ---
    const { accessType, unlockPrice, unlocksAt, storyId } = chapter;

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
      throw new ForbiddenException(
        'Authentication required to access this chapter',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { vipTier: true, vipExpirationDate: true, pulseBalance: true },
    });

    const isVip =
      user &&
      (user.vipTier ?? 0) > 0 &&
      (!user.vipExpirationDate || user.vipExpirationDate > new Date());

    if (accessType === 'vip' || accessType === 'timed') {
      const storyUnlocked = storyId
        ? await this.prisma.userStoryUnlock.findUnique({
            where: { userId_storyId: { userId, storyId } },
            select: { storyId: true },
          })
        : null;

      if (storyUnlocked) {
        setImmediate(() => {
          const unlockType = accessType === 'vip' ? 'VIP' : 'TIMED';
          this.prisma.userChapterUnlock
            .upsert({
              where: { userId_chapterId: { userId, chapterId: id } },
              create: { userId, chapterId: id, pulseAmount: 0, unlockType },
              update: {},
            })
            .catch(() => {
              /* silent */
            });
        });
        return { url };
      }

      if (!isVip) {
        throw new ForbiddenException(
          'VIP membership required to access this chapter',
        );
      }
      // Fire-and-forget: ghi nhận lượt mở (pulseAmount = 0 vì VIP không tốn Pulse)
      setImmediate(() => {
        const unlockType = accessType === 'vip' ? 'VIP' : 'TIMED';
        this.prisma.userChapterUnlock
          .upsert({
            where: { userId_chapterId: { userId, chapterId: id } },
            create: { userId, chapterId: id, pulseAmount: 0, unlockType },
            update: {},
          })
          .catch(() => {
            /* silent — tracking failure must never break playback */
          });
      });
      return { url };
    }

    // Chapter with unlock price: check if user has unlocked it
    const requiredUnlockPrice = Math.max(
      unlockPrice || 0,
      variantUnlockPrice || 0,
    );
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
        throw new ForbiddenException(
          'This chapter must be unlocked before listening',
        );
      }
      // Fire-and-forget: ghi nhận lượt mở bằng Pulse (pulseAmount = 0 nếu là VIP)
      setImmediate(() => {
        const spentPulse = isVip ? 0 : requiredUnlockPrice;
        this.prisma.userChapterUnlock
          .upsert({
            where: { userId_chapterId: { userId, chapterId: id } },
            create: {
              userId,
              chapterId: id,
              pulseAmount: spentPulse,
              unlockType: 'PULSE',
            },
            update: {},
          })
          .catch(() => {
            /* silent */
          });
      });
    }

    return { url };
  }

  async create(storyId: string, data: CreateChapterDto) {
    // Check if story exists
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });
    if (!story) throw new NotFoundException('Story not found');

    console.log('Creating chapter with data:', data);
    const normalizedData = this.normalizeChapterFlatPayload(data as any);
    const timing = buildTimingJson(
      (data as any).content,
      (data as any).timingRaw,
      (data as any).timingFormat,
      (data as any).audioDuration,
    );
    if (timing) (normalizedData as any).timingJson = timing;
    delete (normalizedData as any).timingRaw;
    delete (normalizedData as any).timingFormat;
    const createData: Prisma.ChapterCreateInput = {
      ...(normalizedData as Prisma.ChapterCreateInput),
      story: {
        connect: { id: storyId },
      },
      language: {
        connect: {
          key: (
            (data as CreateChapterDto & { language?: string }).language || 'vi'
          ).trim(),
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

    await this.userFeaturesService.notifyStoryUpdated(
      storyId,
      chapter.id,
      'new_chapter',
    );

    await this.registerChapterHls(chapter);
    return chapter;
  }

  async createStandalone(data: CreateStandaloneChapterDto) {
    const { storyId, ...chapterData } = data;

    const normalizedData = this.normalizeChapterFlatPayload(chapterData as any);
    const standaloneTiming = buildTimingJson(
      (chapterData as any).content,
      (chapterData as any).timingRaw,
      (chapterData as any).timingFormat,
      (chapterData as any).audioDuration,
    );
    if (standaloneTiming) (normalizedData as any).timingJson = standaloneTiming;
    delete (normalizedData as any).timingRaw;
    delete (normalizedData as any).timingFormat;
    const createData: Prisma.ChapterCreateInput = {
      ...(normalizedData as Prisma.ChapterCreateInput),
      ...(storyId ? { story: { connect: { id: storyId } } } : {}),
      language: {
        connect: {
          key: (
            (chapterData as CreateStandaloneChapterDto & { language?: string })
              .language || 'vi'
          ).trim(),
        },
      },
    };

    const chapter = await this.prisma.chapter.create({
      data: createData,
    });

    if (chapter.storyId) {
      await this.userFeaturesService.notifyStoryUpdated(
        chapter.storyId,
        chapter.id,
        'new_chapter',
      );
    }

    await this.registerChapterHls(chapter);
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
      const audioChanged =
        (data as { audioUrl?: unknown }).audioUrl !== undefined ||
        data.r2AudioUrl !== undefined;

      console.log('Updating chapter with data:', data);

      // If storyId is being changed, update totalChapters for both old and new stories
      if (data.storyId !== undefined && data.storyId !== chapter.storyId) {
        // Validate new story exists if storyId is not null
        if (data.storyId) {
          const story = await this.prisma.story.findUnique({
            where: { id: data.storyId },
          });
          if (!story) {
            throw new NotFoundException(
              `Story with ID ${data.storyId} not found`,
            );
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
        const normalizedData =
          Object.keys(otherData).length > 0
            ? this.normalizeChapterFlatPayload(otherData as any)
            : {};

        const updateData: any = {
          ...normalizedData,
          ...(storyId !== undefined
            ? {
                story: storyId
                  ? { connect: { id: storyId } }
                  : { disconnect: true },
              }
            : {}),
          ...(language ? { language: { connect: { key: language } } } : {}),
        };

        // Add chapterNumber if it was set
        if (chapterNumber !== undefined) {
          updateData.chapterNumber = chapterNumber;
        }

        if (data.timingRaw !== undefined) {
          updateData.timingJson =
            buildTimingJson(
              data.content ?? chapter.content,
              data.timingRaw,
              data.timingFormat,
              data.audioDuration ?? chapter.audioDuration ?? undefined,
            ) ?? Prisma.JsonNull;
        }
        delete updateData.timingRaw;
        delete updateData.timingFormat;

        console.log('Final update data:', updateData);

        const updates: any[] = [
          this.prisma.chapter.update({
            where: { id },
            data: updateData,
          }),
        ];

        // Decrement old story's totalChapters
        if (chapter.storyId) {
          updates.push(
            this.prisma.story.update({
              where: { id: chapter.storyId },
              data: { totalChapters: { decrement: 1 } },
            }),
          );
        }

        // Increment new story's totalChapters
        if (storyId) {
          updates.push(
            this.prisma.story.update({
              where: { id: storyId },
              data: { totalChapters: { increment: 1 } },
            }),
          );
        }

        const [updatedChapter] = await this.prisma.$transaction(updates);

        if (updatedChapter.storyId && shouldNotifyUpdate) {
          const updateType =
            chapter.storyId && chapter.storyId === updatedChapter.storyId
              ? 'chapter_updated'
              : 'new_chapter';
          await this.userFeaturesService.notifyStoryUpdated(
            updatedChapter.storyId,
            updatedChapter.id,
            updateType,
          );
        }

        if (audioChanged) await this.registerChapterHls(updatedChapter);
        return updatedChapter;
      }

      // Normal update without storyId change
      const normalizedData = this.normalizeChapterFlatPayload(data as any);
      if (data.timingRaw !== undefined) {
        (normalizedData as any).timingJson =
          buildTimingJson(
            data.content ?? chapter.content,
            data.timingRaw,
            data.timingFormat,
            data.audioDuration ?? chapter.audioDuration ?? undefined,
          ) ?? Prisma.JsonNull;
      }
      delete (normalizedData as any).timingRaw;
      delete (normalizedData as any).timingFormat;
      console.log('Normalized data:', normalizedData);

      const updatedChapter = await this.prisma.chapter.update({
        where: { id },
        data: normalizedData,
      });

      if (updatedChapter.storyId && shouldNotifyUpdate) {
        await this.userFeaturesService.notifyStoryUpdated(
          updatedChapter.storyId,
          updatedChapter.id,
          'chapter_updated',
        );
      }

      if (audioChanged) await this.registerChapterHls(updatedChapter);
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
      }),
    ];

    if (chapter.storyId) {
      updates.push(
        this.prisma.story.update({
          where: { id: chapter.storyId },
          data: { totalChapters: { decrement: 1 } },
        }),
      );
    }

    const [updatedChapter] = await this.prisma.$transaction(updates);

    return updatedChapter;
  }
}
