import { Module } from '@nestjs/common';

import { UploadModule } from '@/upload/upload.module';
import { HlsModule } from '@/hls/hls.module';
import { MusicCommentController } from './music-comment.controller';
import { MusicCommentService } from './music-comment.service';
import { MusicController } from './music.controller';
import { MusicInteractionController } from './music-interaction.controller';
import { MusicInteractionService } from './music-interaction.service';
import { MusicService } from './music.service';

@Module({
  imports: [UploadModule, HlsModule],
  controllers: [MusicController, MusicInteractionController, MusicCommentController],
  providers: [MusicService, MusicInteractionService, MusicCommentService],
  exports: [MusicService],
})
export class MusicModule {}
