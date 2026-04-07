import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, StoryStatus } from '@prisma/client';
import Redis from 'ioredis';

import { StoriesService } from '@/stories/stories.service';

import { MailService } from '@/mail/mail.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { ExploreQueryDto } from '@/stories/dto/explore-query.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { SyncHistoryDto } from './dto/sync-history.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

type PendingHistoryPayload = {
  storyId: string;
  chapterId: string;
  progressSeconds: number;
  lastListenedAt: string;
  variantId?: string;
};

type HistoryListItem = {
  id: string;
  userId: string;
  storyId: string;
  chapterId: string;
  progressSeconds: number;
  lastListenedAt: Date;
  updatedAt: Date;
  story: any;
  chapter: {
    id: string;
    chapterNumber: number;
    title: string | null;
    audioDuration: number | null;
    r2AudioUrl: string | null;
  };
};

@Injectable()
export class UserFeaturesService {
  private readonly logger = new Logger(UserFeaturesService.name);
  private readonly redis: Redis;
  private readonly redisEnabled: boolean;

  private readonly HISTORY_SYNC_KEY = 'history:sync';
  private readonly HISTORY_PROCESSING_KEY = 'history:sync:processing';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => StoriesService))
    private readonly storiesService: StoriesService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.redisEnabled = false;
      this.logger.warn('REDIS_URL is not configured. History sync will fallback to DB writes.');
      return;
    }

    this.redisEnabled = true;
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });

    void this.redis.connect().catch((error) => {
      this.logger.error(`Redis connect failed: ${error?.message || error}`);
    });
  }

  private serializeStory(story: any) {
    const chapterCount = story?._count?.chapters;
    return {
      ...story,
      totalViews: typeof story.totalViews === 'bigint' ? Number(story.totalViews) : story.totalViews,
      totalChapters: typeof chapterCount === 'number' ? chapterCount : (story.totalChapters ?? 0),
    };
  }

  private historyField(userId: string, storyId: string, chapterId: string, variantId?: string) {
    return `${userId}:${storyId}:${chapterId}:${variantId || 'null'}`;
  }

  private parseHistoryField(field: string) {
    const [userId, storyId, chapterId, variantId] = field.split(':');
    if (!userId || !storyId || !chapterId) return null;
    return { 
      userId, 
      storyId, 
      chapterId, 
      variantId: variantId === 'null' ? undefined : variantId 
    };
  }

  private parsePayload(value: string): PendingHistoryPayload | null {
    try {
      const parsed = JSON.parse(value) as PendingHistoryPayload;
      if (!parsed.storyId || !parsed.chapterId) return null;
      return {
        storyId: parsed.storyId,
        chapterId: parsed.chapterId,
        progressSeconds: Math.max(0, Number(parsed.progressSeconds || 0)),
        lastListenedAt: parsed.lastListenedAt || new Date().toISOString(),
        variantId: parsed.variantId,
      };
    } catch {
      return null;
    }
  }

  private async scanUserPendingFromHash(hashKey: string, userId: string) {
    if (!this.redisEnabled || !this.redis) return new Map<string, PendingHistoryPayload>();

    const map = new Map<string, PendingHistoryPayload>();
    let cursor = '0';
    const prefix = `${userId}:`;

    do {
      const [nextCursor, entries] = await this.redis.hscan(hashKey, cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
      cursor = nextCursor;
      for (let i = 0; i < entries.length; i += 2) {
        const field = entries[i];
        const value = entries[i + 1];
        if (!field || !value) continue;

        const parsedKey = this.parseHistoryField(field);
        const payload = this.parsePayload(value);
        if (!parsedKey || !payload || parsedKey.userId !== userId) continue;

        map.set(parsedKey.chapterId, payload);
      }
    } while (cursor !== '0');

    return map;
  }

  private async removeUserPending(userId: string, hashKey: string) {
    if (!this.redisEnabled || !this.redis) return;

    let cursor = '0';
    const toDelete: string[] = [];

    do {
      const [nextCursor, entries] = await this.redis.hscan(hashKey, cursor, 'MATCH', `${userId}:*`, 'COUNT', 200);
      cursor = nextCursor;

      for (let i = 0; i < entries.length; i += 2) {
        const field = entries[i];
        if (field) toDelete.push(field);
      }
    } while (cursor !== '0');

    if (toDelete.length > 0) {
      await this.redis.hdel(hashKey, ...toDelete);
    }
  }

  async toggleFavorite(userId: string, storyId: string) {
    const existing = await this.prisma.userFavorite.findUnique({
      where: {
        userId_storyId: {
          userId,
          storyId,
        },
      },
    });

    if (existing) {
      await this.prisma.userFavorite.delete({
        where: {
          userId_storyId: {
            userId,
            storyId,
          },
        },
      });
      // Decrement favoritesCount on story
      await this.prisma.story.update({
        where: { id: storyId },
        data: { favoritesCount: { decrement: 1 } },
      });
      await this.storiesService.invalidateExploreCache();
      return { isFavorite: false };
    }

    await this.prisma.userFavorite.create({
      data: {
        userId,
        storyId,
      },
    });
    // Increment favoritesCount on story
    await this.prisma.story.update({
      where: { id: storyId },
      data: { favoritesCount: { increment: 1 } },
    });
    await this.storiesService.invalidateExploreCache();

    return { isFavorite: true };
  }

  async getStorySubscriptionStatus(userId: string, storyId: string) {
    const subscription = await this.prisma.userStorySubscription.findUnique({
      where: {
        userId_storyId: {
          userId,
          storyId,
        },
      },
      select: { userId: true },
    });

    return { isSubscribed: Boolean(subscription) };
  }

  async toggleStorySubscription(userId: string, storyId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, deletedAt: true },
    });

    if (!story || story.deletedAt) {
      throw new NotFoundException('Story not found');
    }

    const existing = await this.prisma.userStorySubscription.findUnique({
      where: {
        userId_storyId: {
          userId,
          storyId,
        },
      },
    });

    if (existing) {
      await this.prisma.userStorySubscription.delete({
        where: {
          userId_storyId: {
            userId,
            storyId,
          },
        },
      });

      return { isSubscribed: false };
    }

    await this.prisma.userStorySubscription.create({
      data: {
        userId,
        storyId,
      },
    });

    return { isSubscribed: true };
  }

  async notifyStoryUpdated(
    storyId: string,
    chapterId: string,
    updateType: 'new_chapter' | 'chapter_updated',
  ) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        slug: true,
        title: true,
        userStorySubscriptions: {
          select: {
            userId: true,
            user: {
              select: {
                email: true,
                allowBellNoti: true,
                allowEmailNoti: true,
              },
            },
          },
        },
      },
    });

    if (!story || story.userStorySubscriptions.length === 0) {
      return;
    }

    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        storyId: true,
        chapterNumber: true,
        title: true,
      },
    });

    if (!chapter || chapter.storyId !== storyId) {
      return;
    }

    const storyTitle = story.title;
    const chapterTitle = chapter.title;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const storyUrl = `${frontendUrl}/story/${story.slug}/chuong-${chapter.chapterNumber}`;

    await Promise.all(
      story.userStorySubscriptions.map(async (subscription) => {
        if (subscription.user.allowBellNoti) {
          await this.notificationsService.createStoryUpdateNotification(subscription.userId, {
            storyId: story.id,
            storySlug: story.slug,
            storyTitle,
            chapterId: chapter.id,
            chapterNumber: chapter.chapterNumber,
            chapterTitle,
            updateType,
          });
        }

        if (subscription.user.allowEmailNoti) {
          await this.mailService.sendStoryUpdateEmail(subscription.user.email, {
            storyTitle,
            chapterNumber: chapter.chapterNumber,
            chapterTitle,
            storyUrl,
            updateType,
          });
        }
      }),
    );
  }

  async getFavorites(userId: string, query: ExploreQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.UserFavoriteWhereInput = {
      userId,
      story: {
        deletedAt: null,
        ...(query.status ? { status: query.status as StoryStatus } : {}),
        ...(query.categoryId
          ? {
            categories: {
              some: {
                categoryId: query.categoryId,
              },
            },
          }
          : {}),
        ...(query.authorId ? { authorId: query.authorId } : {}),
        ...(query.search
          ? {
            OR: [
              { title: { contains: query.search } },
              { author: { name: { contains: query.search } } },
            ],
          }
          : {}),
      },
    };

    const orderBy: Prisma.UserFavoriteOrderByWithRelationInput =
      query.sort === 'views'
        ? { story: { totalViews: 'desc' } }
        : query.sort === 'title_asc'
          ? { story: { title: 'asc' } }
          : query.sort === 'chapters_desc'
            ? { story: { totalChapters: 'desc' } }
            : { createdAt: 'desc' };

    const [total, favoriteRows] = await Promise.all([
      this.prisma.userFavorite.count({ where }),
      this.prisma.userFavorite.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        select: {
          story: {
            select: {
              id: true,
              slug: true,
              title: true,
              thumbnailUrl: true,
              totalViews: true,
              status: true,
              createdAt: true,
              totalChapters: true,
              author: {
                select: {
                  id: true,
                  name: true,
                },
              },
              _count: {
                select: {
                  chapters: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const stories = favoriteRows.map((row) => row.story).filter(Boolean);

    return {
      data: stories.map((story) => ({ ...this.serializeStory(story), isFavorite: true })),
      meta: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async syncHistory(userId: string, dto: SyncHistoryDto) {
    const payload: PendingHistoryPayload = {
      storyId: dto.storyId,
      chapterId: dto.chapterId,
      progressSeconds: Math.max(0, Math.floor(dto.progressSeconds)),
      lastListenedAt: new Date().toISOString(),
    };

    if (!this.redisEnabled || !this.redis) {
      try {
        // Handle null variantId case separately
        if (!dto.variantId) {
          // Find existing record without variantId
          const existing = await this.prisma.listeningHistory.findFirst({
            where: {
              userId,
              chapterId: dto.chapterId,
              variantId: null,
            },
          });

          if (existing) {
            // Update existing record
            await this.prisma.listeningHistory.update({
              where: { id: existing.id },
              data: {
                storyId: dto.storyId,
                progressSeconds: payload.progressSeconds,
                lastListenedAt: new Date(payload.lastListenedAt),
              },
            });
          } else {
            // Create new record
            await this.prisma.listeningHistory.create({
              data: {
                userId,
                storyId: dto.storyId,
                chapterId: dto.chapterId,
                variantId: null,
                progressSeconds: payload.progressSeconds,
                lastListenedAt: new Date(payload.lastListenedAt),
              },
            });
          }
        } else {
          // Use upsert for non-null variantId
          await (this.prisma.listeningHistory as any).upsert({
            where: {
              userId_chapterId_variantId: {
                userId,
                chapterId: dto.chapterId,
                variantId: dto.variantId,
              },
            },
            update: {
              storyId: dto.storyId,
              progressSeconds: payload.progressSeconds,
              lastListenedAt: new Date(payload.lastListenedAt),
            },
            create: {
              userId,
              storyId: dto.storyId,
              chapterId: dto.chapterId,
              variantId: dto.variantId,
              progressSeconds: payload.progressSeconds,
              lastListenedAt: new Date(payload.lastListenedAt),
            },
          });
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          // Fallback to update if create failed due to race condition
          const existing = await this.prisma.listeningHistory.findFirst({
            where: {
              userId,
              chapterId: dto.chapterId,
              variantId: dto.variantId || null,
            },
          });
          
          if (existing) {
            await this.prisma.listeningHistory.update({
              where: { id: existing.id },
              data: {
                storyId: dto.storyId,
                progressSeconds: payload.progressSeconds,
                lastListenedAt: new Date(payload.lastListenedAt),
              },
            });
          }
        } else {
          throw error;
        }
      }

      return { synced: true, mode: 'db' };
    }

    await this.redis.hset(
      this.HISTORY_SYNC_KEY,
      this.historyField(userId, dto.storyId, dto.chapterId, dto.variantId),
      JSON.stringify(payload),
    );

    return { synced: true, mode: 'redis' };
  }

  async getHistory(userId: string, query: HistoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const chapterId = query.chapterId;
    const variantId = query.variantId;
    const where = {
      userId,
      ...(chapterId ? { chapterId } : {}),
      ...(variantId ? { variantId } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.listeningHistory.count({ where }),
      this.prisma.listeningHistory.findMany({
        where,
        orderBy: { lastListenedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          story: {
            select: {
              id: true,
              slug: true,
              title: true,
              thumbnailUrl: true,
              totalViews: true,
              status: true,
              author: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          chapter: {
            select: {
              id: true,
              chapterNumber: true,
              title: true,
              audioDuration: true,
              r2AudioUrl: true,
            },
          },
        },
      }),
    ]);

    const merged = new Map<string, HistoryListItem>(
      rows.map((row) => [
        row.chapterId,
        {
          ...row,
          story: this.serializeStory(row.story),
        },
      ]),
    );

    if (this.redisEnabled && this.redis) {
      const [pendingMain, pendingProcessing] = await Promise.all([
        this.scanUserPendingFromHash(this.HISTORY_SYNC_KEY, userId),
        this.scanUserPendingFromHash(this.HISTORY_PROCESSING_KEY, userId),
      ]);

      const pendingAll = new Map<string, PendingHistoryPayload>([...pendingMain, ...pendingProcessing]);
      const pendingChapterIds = [
        ...new Set(Array.from(pendingAll.values()).map((pending) => pending.chapterId)),
      ];

      const pendingChapters = pendingChapterIds.length
        ? await this.prisma.chapter.findMany({
            where: {
              id: { in: pendingChapterIds },
            },
            select: {
              id: true,
              storyId: true,
              chapterNumber: true,
              title: true,
              audioDuration: true,
              r2AudioUrl: true,
              story: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  thumbnailUrl: true,
                  totalViews: true,
                  status: true,
                  author: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          })
        : [];

      const pendingChapterMap = new Map(pendingChapters.map((chapter) => [chapter.id, chapter]));

      for (const [chapterId, pending] of pendingAll.entries()) {
        const existing = merged.get(chapterId);
        if (existing) {
          const pendingTime = new Date(pending.lastListenedAt).getTime();
          const currentTime = new Date(existing.lastListenedAt).getTime();
          if (pendingTime >= currentTime) {
            existing.progressSeconds = pending.progressSeconds;
            existing.lastListenedAt = new Date(pending.lastListenedAt);
          }
          continue;
        }

        const chapter = pendingChapterMap.get(pending.chapterId);

        if (!chapter || !chapter.storyId) continue;

        merged.set(chapter.id, {
          id: `pending:${userId}:${chapter.id}`,
          userId,
          storyId: chapter.storyId,
          chapterId: chapter.id,
          progressSeconds: pending.progressSeconds,
          lastListenedAt: new Date(pending.lastListenedAt),
          updatedAt: new Date(pending.lastListenedAt),
          story: this.serializeStory(chapter.story),
          chapter: {
            id: chapter.id,
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            audioDuration: chapter.audioDuration,
            r2AudioUrl: chapter.r2AudioUrl,
          },
        });
      }
    }

    const mergedList: HistoryListItem[] = [...merged.values()].sort(
      (a, b) => new Date(b.lastListenedAt).getTime() - new Date(a.lastListenedAt).getTime(),
    );

    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      data: mergedList.slice(start, end),
      meta: {
        total: mergedList.length,
        page,
        lastPage: Math.max(1, Math.ceil(mergedList.length / limit)),
      },
    };
  }

  async deleteHistoryItem(userId: string, historyId: string) {
    const existing = await this.prisma.listeningHistory.findUnique({
      where: { id: historyId },
      select: {
        id: true,
        userId: true,
        storyId: true,
        chapterId: true,
        variantId: true,
      },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('History item not found');
    }

    await this.prisma.listeningHistory.delete({ where: { id: historyId } });

    if (this.redisEnabled && this.redis) {
      const field = this.historyField(userId, existing.storyId, existing.chapterId, existing.variantId || undefined);
      await Promise.all([
        this.redis.hdel(this.HISTORY_SYNC_KEY, field),
        this.redis.hdel(this.HISTORY_PROCESSING_KEY, field),
      ]);
    }

    return { ok: true };
  }

  async clearHistory(userId: string) {
    await this.prisma.listeningHistory.deleteMany({ where: { userId } });

    if (this.redisEnabled && this.redis) {
      await Promise.all([
        this.removeUserPending(userId, this.HISTORY_SYNC_KEY),
        this.removeUserPending(userId, this.HISTORY_PROCESSING_KEY),
      ]);
    }

    return { ok: true };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async flushHistorySyncCache() {
    if (!this.redisEnabled || !this.redis) return;

    try {
      const moved = await this.redis.eval(
        `if redis.call('EXISTS', KEYS[1]) == 1 then
          if redis.call('EXISTS', KEYS[2]) == 1 then
            return 0
          end
          redis.call('RENAME', KEYS[1], KEYS[2])
          return 1
        end
        return -1`,
        2,
        this.HISTORY_SYNC_KEY,
        this.HISTORY_PROCESSING_KEY,
      );

      if (Number(moved) <= 0) return;

      const payload = await this.redis.hgetall(this.HISTORY_PROCESSING_KEY);
      const fields = Object.keys(payload);
      if (!fields.length) {
        await this.redis.del(this.HISTORY_PROCESSING_KEY);
        return;
      }

      const writes: Prisma.PrismaPromise<any>[] = [];
      for (const field of fields) {
        const parsedKey = this.parseHistoryField(field);
        const parsedPayload = this.parsePayload(payload[field]);
        if (!parsedKey || !parsedPayload) continue;

        writes.push(
          this.prisma.listeningHistory.upsert({
            where: {
              userId_chapterId_variantId: {
                userId: parsedKey.userId,
                chapterId: parsedKey.chapterId,
                variantId: (parsedKey.variantId ?? null) as any,
              },
            },
            update: {
              storyId: parsedKey.storyId,
              progressSeconds: parsedPayload.progressSeconds,
              lastListenedAt: new Date(parsedPayload.lastListenedAt),
            },
            create: {
              userId: parsedKey.userId,
              storyId: parsedKey.storyId,
              chapterId: parsedKey.chapterId,
              variantId: parsedKey.variantId || null,
              progressSeconds: parsedPayload.progressSeconds,
              lastListenedAt: new Date(parsedPayload.lastListenedAt),
            },
          }),
        );
      }

      if (writes.length > 0) {
        await this.prisma.$transaction(writes);
      }

      await this.redis.del(this.HISTORY_PROCESSING_KEY);
      this.logger.log(`History sync cron flushed ${writes.length} items.`);
    } catch (error) {
      this.logger.error(`History sync cron failed: ${error?.message || error}`);
    }
  }
}
