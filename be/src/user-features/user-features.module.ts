import { Module } from '@nestjs/common';

import { PrismaModule } from '@/prisma/prisma.module';
import { UserFeaturesController } from './user-features.controller';
import { UserFeaturesService } from './user-features.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserFeaturesController],
  providers: [UserFeaturesService],
  exports: [UserFeaturesService],
})
export class UserFeaturesModule {}
