import { Module } from '@nestjs/common';

import { AudioUploadService } from './audio-upload.service';
import { UploadController } from './upload.controller';

@Module({
  controllers: [UploadController],
  providers: [AudioUploadService],
  exports: [AudioUploadService],
})
export class UploadModule {}
