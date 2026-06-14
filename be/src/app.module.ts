import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './shared/config/app-config.module';
import { AppConfigService } from './shared/config/app-config.service';
import { LoggerModule } from './shared/logging/logger.module';
import { CorrelationIdMiddleware } from './shared/logging/correlation-id.middleware';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { redisStore } from 'cache-manager-redis-yet';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { StatsModule } from './stats/stats.module';
import { StoriesModule } from './stories/stories.module';
import { CategoriesModule } from './categories/categories.module';
import { AuthorsModule } from './authors/authors.module';
import { ChaptersModule } from './chapters/chapters.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CommentsModule } from './comments/comments.module';
import { SettingsModule } from './settings/settings.module';
import { MembershipsModule } from './memberships/memberships.module';
import { PackagesModule } from './packages/packages.module';
import { ChapterCommentsModule } from './chapter-comments/chapter-comments.module';
import { UserFeaturesModule } from './user-features/user-features.module';
import { BillingModule } from './billing/billing.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadModule } from './upload/upload.module';
import { LanguagesModule } from './languages/languages.module';
import { BannersModule } from './banners/banners.module';
import { AdsModule } from './ads/ads.module';
import { TrackingModule } from './tracking/tracking.module';
import { SocialLinksModule } from './social-links/social-links.module';
import { MusicModule } from './music/music.module';
import { PersonalPlaylistModule } from './personal-playlist/personal-playlist.module';
import { buildScheduleImports } from './common/app-role.util';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    // TODO: Remove once all ConfigService consumers migrate to AppConfigService (Phase 1+)
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [AppConfigService],
      useFactory: async (cfg: AppConfigService) => {
        const redisUrl = cfg.redis.url;
        return {
          store: await redisStore({ url: redisUrl }),
          ttl: 300,
        };
      },
    }),
    ...buildScheduleImports(process.env),
    // Rate limiting: 100 requests per 60 seconds per IP globally
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,   // time-to-live in ms (60 seconds)
        limit: 100,    // max requests per TTL per IP
      },
    ]),
    PrismaModule,
    AuthModule,
    MailModule,
    StatsModule,
    StoriesModule,
    CategoriesModule,
    AuthorsModule,
    ChaptersModule,
    TransactionsModule,
    CommentsModule,
    SettingsModule,
    MembershipsModule,
    PackagesModule,
    ChapterCommentsModule,
    UserFeaturesModule,
    BillingModule,
    ReviewsModule,
    NotificationsModule,
    UploadModule,
    LanguagesModule,
    BannersModule,
    AdsModule,
    TrackingModule,
    SocialLinksModule,
    MusicModule,
    PersonalPlaylistModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply CustomThrottlerGuard globally (can be disabled via THROTTLE_DISABLED in non-production)
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
