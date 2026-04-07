import { Module } from '@nestjs/common';

import { UploadModule } from '@/upload/upload.module';
import { MusicController } from './music.controller';
import { MusicService } from './music.service';

@Module({
  imports: [UploadModule],
  controllers: [MusicController],
  providers: [MusicService],
  exports: [MusicService],
})
export class MusicModule {}
