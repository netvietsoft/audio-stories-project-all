import { Module } from '@nestjs/common';

import { PrismaModule } from '@/prisma/prisma.module';
import { GeoModule } from '@/common/geo/geo.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  imports: [PrismaModule, GeoModule],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
