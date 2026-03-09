import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, StoryStatus } from '@prisma/client';
import Redis from 'ioredis';

import { ExploreQueryDto } from '@/stories/dto/explore-query.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { SyncHistoryDto } from './dto/sync-history.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

type PendingHistoryPayload = {
  storyId: string;
  chapterId: string;
  progressSeconds: number;
  lastListenedAt: string;
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

  private historyField(userId: string, storyId: string, chapterId: string) {
    return `${userId}:${storyId}:${chapterId}`;
  }

  private parseHistoryField(field: string) {
    const [userId, storyId, chapterId] = field.split(':');
    if (!userId || !storyId || !chapterId) return null;
    return { userId, storyId, chapterId };
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
      return { isFavorite: false };
    }

    await this.prisma.userFavorite.create({
      data: {
        userId,
        storyId,
      },
    });

    return { isFavorite: true };
  }

  async getFavorites(userId: string, query: ExploreQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.StoryWhereInput = {
      deletedAt: null,
      userFavorites: {
        some: {
          userId,
        },
      },
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
    };

    const orderBy: Prisma.StoryOrderByWithRelationInput =
      query.sort === 'views'
        ? { totalViews: 'desc' }
        : query.sort === 'title_asc'
          ? { title: 'asc' }
          : query.sort === 'chapters_desc'
            ? { chapters: { _count: 'desc' } }
            : { createdAt: 'desc' };

    const [total, stories] = await Promise.all([
      this.prisma.story.count({ where }),
      this.prisma.story.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
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
      }),
    ]);

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
      await this.prisma.listeningHistory.upsert({
        where: {
          userId_chapterId: {
            userId,
            chapterId: dto.chapterId,
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
          progressSeconds: payload.progressSeconds,
          lastListenedAt: new Date(payload.lastListenedAt),
        },
      });

      return { synced: true, mode: 'db' };
    }

    await this.redis.hset(
      this.HISTORY_SYNC_KEY,
      this.historyField(userId, dto.storyId, dto.chapterId),
      JSON.stringify(payload),
    );

    return { synced: true, mode: 'redis' };
  }

  async getHistory(userId: string, query: HistoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, rows] = await Promise.all([
      this.prisma.listeningHistory.count({ where: { userId } }),
      this.prisma.listeningHistory.findMany({
        where: { userId },
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

    const merged = new Map(
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

      const pendingAll = new Map([...pendingMain, ...pendingProcessing]);

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

        const chapter = await this.prisma.chapter.findUnique({
          where: { id: pending.chapterId },
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
        });

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

    const mergedList = [...merged.values()].sort(
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
      },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('History item not found');
    }

    await this.prisma.listeningHistory.delete({ where: { id: historyId } });

    if (this.redisEnabled && this.redis) {
      const field = this.historyField(userId, existing.storyId, existing.chapterId);
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
              userId_chapterId: {
                userId: parsedKey.userId,
                chapterId: parsedKey.chapterId,
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
