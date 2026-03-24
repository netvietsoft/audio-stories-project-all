import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (!redisUrl) {
          return {
            ttl: 300,
            max: 500,
          };
        }

        return {
          store: await redisStore({ url: redisUrl }),
          ttl: 300,
        };
      },
    }),
    ScheduleModule.forRoot(),
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply ThrottlerGuard globally for all routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
