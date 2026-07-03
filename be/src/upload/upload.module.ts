import { Module } from '@nestjs/common';

import { AudioUploadService } from './audio-upload.service';
import { ImageUploadService } from './image-upload.service';
import { UploadController } from './upload.controller';

@Module({
  controllers: [UploadController],
  providers: [AudioUploadService, ImageUploadService],
  exports: [AudioUploadService, ImageUploadService],
})
export class UploadModule {}
