import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';

import { PrismaService } from '@/prisma/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';

type TrackKind = 'view' | 'listen';

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
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
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

      const [storyKeys, chapterKeys] = await Promise.all([
        this.scanKeys(`${this.STORY_VIEWS_PREFIX}*`),
        this.scanKeys(`${this.CHAPTER_VIEWS_PREFIX}*`),
      ]);

      if (!storyKeys.length && !chapterKeys.length) {
        return;
      }

      const processingEntries: Array<{
        originalKey: string;
        processingKey: string;
        count: number;
      }> = [];
      const writes: any[] = [];

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

      await collectByPrefix(storyKeys, this.STORY_VIEWS_PREFIX, (storyId, count) =>
        this.prisma.story.updateMany({
          where: { id: storyId },
          data: { totalViews: { increment: count } },
        }),
      );

      await collectByPrefix(chapterKeys, this.CHAPTER_VIEWS_PREFIX, (chapterId, count) =>
        this.prisma.chapter.updateMany({
          where: { id: chapterId },
          data: { viewCount: { increment: count } },
        }),
      );

      if (writes.length > 0) {
        try {
          await this.prisma.$transaction(writes);
        } catch (dbError) {
          // Rollback counters back to live keys if DB flush fails.
          for (const entry of processingEntries) {
            await this.redis.multi().incrby(entry.originalKey, entry.count).del(entry.processingKey).exec();
          }
          throw dbError;
        }
      }

      const processingKeys = processingEntries.map((entry) => entry.processingKey);
      if (processingKeys.length > 0) {
        await this.redis.del(...processingKeys);
      }

      this.logger.log(`[Tracking BE] Du lieu da ghi vao Database thanh cong! Da xoa cac key processing.`);
      this.logger.log(`Flushed tracking counters safely. Keys processed: ${processingEntries.length}.`);
    } catch (error) {
      this.logger.error(`Failed to flush tracking counters: ${error?.message || error}`);
    }
  }
}
