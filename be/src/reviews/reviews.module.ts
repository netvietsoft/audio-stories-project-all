import { Module } from '@nestjs/common';

import { GeoModule } from '@/common/geo/geo.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [PrismaModule, GeoModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
