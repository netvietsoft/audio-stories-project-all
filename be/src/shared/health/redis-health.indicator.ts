import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator implements OnModuleInit, OnModuleDestroy {
  private client?: Redis;

  constructor(private readonly cfg: AppConfigService) {
    super();
  }

  onModuleInit(): void {
    this.client = new Redis(this.cfg.redis.url, {
      maxRetriesPerRequest: 1,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.client!.ping();
      const isHealthy = pong === 'PONG';
      const result = this.getStatus(key, isHealthy);
      if (!isHealthy) {
        throw new HealthCheckError('Redis ping unexpected response', result);
      }
      return result;
    } catch (err) {
      if (err instanceof HealthCheckError) throw err;
      const message = err instanceof Error ? err.message : 'unknown';
      throw new HealthCheckError(
        'Redis ping failed',
        this.getStatus(key, false, { error: message }),
      );
    }
  }
}
