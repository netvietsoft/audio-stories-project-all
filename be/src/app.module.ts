import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
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
    ReviewsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
