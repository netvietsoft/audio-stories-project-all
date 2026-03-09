import { Module } from '@nestjs/common';

import { PrismaModule } from '@/prisma/prisma.module';
import { ChapterCommentsController } from './chapter-comments.controller';
import { ChapterCommentsService } from './chapter-comments.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChapterCommentsController],
  providers: [ChapterCommentsService],
})
export class ChapterCommentsModule {}
