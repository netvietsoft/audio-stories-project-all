import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';

import { PrismaService } from '@/prisma/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';

type TrackKind = 'view' | 'listen';

export function buildDailyViewUpsertArgs(storyId: string, count: number, day: Date) {
  return {
    where: { storyId_date: { storyId, date: day } },
    create: { storyId, date: day, views: count },
    update: { views: { increment: count } },
  };
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly redis: Redis;
  private readonly redisEnabled: boolean;

  private readonly DEDUP_TTL_SECONDS = 3600;
  private readonly STORY_VIEWS_PREFIX = 'story:views:';
  private readonly CHAPTER_VIEWS_PREFIX = 'chapter:views:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.redisEnabled = false;
      this.logger.error('REDIS_URL is required for tracking module.');
      return;
    }

    this.redisEnabled = true;
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      enableReadyCheck: true,
      // Reconnection strategy: retry with exponential backoff
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000); // Cap at 2 seconds
        return delay;
      },
      // Use 3 retries per request for better resilience
      maxRetriesPerRequest: 3,
      // Connection timeout and command timeout for better handling
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    // Attach error handler to prevent unhandled errors from crashing the app
    this.redis.on('error', (err) => {
      this.logger.error(`Redis Client Error: ${err?.message || err}`);
      // Error is logged but not thrown - allows app to continue operating
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis Client connected to Tracking service');
      // Enable TCP keep-alive on the underlying socket (30s interval)
      try {
        const socket = (this.redis as any).stream?.socket;
        if (socket) {
          socket.setKeepAlive(true, 30000);
        }
      } catch (err) {
        this.logger.warn(`Failed to set socket keepAlive: ${err?.message || err}`);
      }
    });

    this.redis.on('reconnecting', () => {
      this.logger.log('Redis Client reconnecting...');
    });

    void this.redis.connect().catch((error) => {
      this.logger.error(`Tracking Redis connect failed: ${error?.message || error}`);
    });
  }

  private ensureRedisEnabled() {
    if (!this.redisEnabled || !this.redis) {
      throw new ServiceUnavailableException('Tracking service is unavailable.');
    }
  }

  private dedupKey(kind: TrackKind, storyId: string, chapterId: string, deviceId: string) {
    return `track:${kind}:${storyId}:${chapterId}:${deviceId}`;
  }

  private async track(kind: TrackKind, dto: TrackEventDto) {
    this.ensureRedisEnabled();

    const dedupKey = this.dedupKey(kind, dto.storyId, dto.chapterId, dto.deviceId);
    const storyCounterKey = `${this.STORY_VIEWS_PREFIX}${dto.storyId}`;
    const chapterCounterKey = `${this.CHAPTER_VIEWS_PREFIX}${dto.chapterId}`;

    const created = await this.redis.set(dedupKey, '1', 'EX', this.DEDUP_TTL_SECONDS, 'NX');
    if (!created) {
      this.logger.debug(
        `[Tracking BE] Bo qua (Spam/Dedup) - Loai: ${kind}, Story: ${dto.storyId}, Device: ${dto.deviceId}`,
      );
      return { counted: false, deduplicated: true };
    }

    await this.redis.multi().incr(storyCounterKey).incr(chapterCounterKey).exec();
    this.logger.log(
      `[Tracking BE] +1 Tam thoi (Redis) - Loai: ${kind}, Story: ${dto.storyId}, Chapter: ${dto.chapterId}`,
    );
    return { counted: true, deduplicated: false };
  }

  async trackView(dto: TrackEventDto) {
    return this.track('view', dto);
  }

  async trackListen(dto: TrackEventDto) {
    return this.track('listen', dto);
  }

  private async scanKeys(pattern: string) {
    this.ensureRedisEnabled();

    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
      cursor = nextCursor;
      if (batch.length > 0) {
        keys.push(...batch);
      }
    } while (cursor !== '0');

    return keys;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async flushTrackingCounters() {
    if (!this.redisEnabled || !this.redis) return;

    try {
      this.logger.log(`[Tracking BE] Bat dau tien trinh Flush Redis -> Database...`);

      let storyKeys: string[] = [];
      let chapterKeys: string[] = [];

      try {
        [storyKeys, chapterKeys] = await Promise.all([
          this.scanKeys(`${this.STORY_VIEWS_PREFIX}*`),
          this.scanKeys(`${this.CHAPTER_VIEWS_PREFIX}*`),
        ]);
      } catch (scanError) {
        this.logger.warn(
          `[Tracking BE] Failed to scan Redis keys: ${scanError?.message || scanError}. Skipping this flush cycle.`,
        );
        return; // Skip this cycle - next cycle will retry
      }

      if (!storyKeys.length && !chapterKeys.length) {
        return;
      }

      const processingEntries: Array<{
        originalKey: string;
        processingKey: string;
        count: number;
      }> = [];
      const writes: any[] = [];
      const storyViewDeltas: Array<{ storyId: string; count: number }> = [];

      const collectByPrefix = async (
        keys: string[],
        prefix: string,
        buildWrite: (id: string, count: number) => any,
      ) => {
        for (const key of keys) {
          const suffix = key.slice(prefix.length);
          if (!suffix) continue;

          const processingKey = `${key}:processing:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

          try {
            // Atomic swap: after RENAME, new INCR will hit a fresh key and won't be lost.
            await this.redis.rename(key, processingKey);
          } catch {
            // Key can disappear due to another worker/timing window, safe to skip.
            continue;
          }

          let count = 0;
          try {
            const countStr = await this.redis.get(processingKey);
            count = Number.parseInt(countStr || '0', 10);
            if (!Number.isFinite(count) || count <= 0) {
              await this.redis.del(processingKey);
              continue;
            }
          } catch {
            // Best effort restore if read fails after rename.
            await this.redis
              .multi()
              .incrby(key, Math.max(0, count))
              .del(processingKey)
              .exec();
            continue;
          }

          processingEntries.push({
            originalKey: key,
            processingKey,
            count,
          });

          if (prefix === this.STORY_VIEWS_PREFIX) {
            this.logger.log(`[Tracking BE] Chuan bi cap nhat DB cho Story [${suffix}]: +${count} views`);
          }

          if (prefix === this.CHAPTER_VIEWS_PREFIX) {
            this.logger.log(`[Tracking BE] Chuan bi cap nhat DB cho Chapter [${suffix}]: +${count} views`);
          }

          writes.push(buildWrite(suffix, count));
        }
      };

      await collectByPrefix(storyKeys, this.STORY_VIEWS_PREFIX, (storyId, count) => {
        storyViewDeltas.push({ storyId, count });
        return this.prisma.story.updateMany({
          where: { id: storyId },
          data: { totalViews: { increment: count } },
        });
      });

      await collectByPrefix(chapterKeys, this.CHAPTER_VIEWS_PREFIX, (chapterId, count) =>
        this.prisma.chapter.updateMany({
          where: { id: chapterId },
          data: { viewCount: { increment: count } },
        }),
      );

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      for (const { storyId, count } of storyViewDeltas) {
        writes.push(this.prisma.storyViewDaily.upsert(buildDailyViewUpsertArgs(storyId, count, today)));
      }

      if (writes.length > 0) {
        try {
          await this.prisma.$transaction(writes);
        } catch (dbError) {
          // Rollback counters back to live keys if DB flush fails.
          this.logger.warn(`Database transaction failed, attempting to restore counters to Redis...`);
          for (const entry of processingEntries) {
            try {
              await this.redis.multi().incrby(entry.originalKey, entry.count).del(entry.processingKey).exec();
            } catch (restoreError) {
              this.logger.error(
                `Failed to restore counter for key [${entry.originalKey}]: ${restoreError?.message || restoreError}`,
              );
              // Best effort - continue with next entry even if restore fails
            }
          }
          throw dbError;
        }
      }

      const processingKeys = processingEntries.map((entry) => entry.processingKey);
      if (processingKeys.length > 0) {
        try {
          await this.redis.del(...processingKeys);
        } catch (delError) {
          this.logger.warn(
            `Failed to delete processing keys from Redis: ${delError?.message || delError}. Data is safe but cleanup incomplete.`,
          );
          // Not critical - continue even if cleanup fails
        }
      }

      this.logger.log(`[Tracking BE] Du lieu da ghi vao Database thanh cong! Da xoa cac key processing.`);
      this.logger.log(`Flushed tracking counters safely. Keys processed: ${processingEntries.length}.`);
    } catch (error) {
      this.logger.error(
        `[Tracking BE] Failed to flush tracking counters: ${error?.message || error}. Will retry on next cycle.`,
      );
      // Error is logged but NOT re-thrown - prevents cronjob from crashing the application
    }
  }
}
