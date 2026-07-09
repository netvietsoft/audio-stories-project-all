import { Module } from '@nestjs/common';

import { GeoModule } from '@/common/geo/geo.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { ChapterCommentsController } from './chapter-comments.controller';
import { ChapterCommentsService } from './chapter-comments.service';

@Module({
  imports: [PrismaModule, GeoModule],
  controllers: [ChapterCommentsController],
  providers: [ChapterCommentsService],
})
export class ChapterCommentsModule {}
