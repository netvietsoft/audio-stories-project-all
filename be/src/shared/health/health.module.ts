import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis-health.indicator';
import { PrismaModule } from '../../prisma/prisma.module';
import { AppConfigModule } from '../config/app-config.module';

@Module({
  imports: [TerminusModule, HttpModule, PrismaModule, AppConfigModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
