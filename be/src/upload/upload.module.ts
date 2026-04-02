import { Module } from '@nestjs/common';

import { AudioUploadService } from './audio-upload.service';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  controllers: [UploadController],
  providers: [AudioUploadService, UploadService],
  exports: [AudioUploadService, UploadService],
})
export class UploadModule {}
