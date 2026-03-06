import { Module } from '@nestjs/common';

import { PrismaModule } from '@/prisma/prisma.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { UploadModule } from '@/upload/upload.module';

@Module({
  imports: [PrismaModule, UploadModule],

  controllers: [StoriesController],

  providers: [StoriesService],
})
export class StoriesModule { }
