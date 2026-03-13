import { Module } from '@nestjs/common';

import { MailModule } from '@/mail/mail.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserFeaturesController } from './user-features.controller';
import { UserFeaturesService } from './user-features.service';

@Module({
  imports: [PrismaModule, NotificationsModule, MailModule],
  controllers: [UserFeaturesController],
  providers: [UserFeaturesService],
  exports: [UserFeaturesService],
})
export class UserFeaturesModule {}
