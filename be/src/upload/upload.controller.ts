import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { AudioUploadFolder, AudioUploadService } from './audio-upload.service';
import { ImageUploadService } from './image-upload.service';

@Controller('upload')
export class UploadController {
  constructor(
    private readonly audioUploadService: AudioUploadService,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  @Post('audio')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAudio(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 100 * 1024 * 1024 })
        .addFileTypeValidator({ fileType: /^audio\/.*/i })
        .build({
          fileIsRequired: true,
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        }),
    )
    file: { originalname: string; mimetype: string; buffer: Buffer },
      @Body('folder') folder?: string,
  ) {
    const uploadFolder = this.resolveAudioFolder(folder);
    const url = await this.audioUploadService.uploadAudio(file, uploadFolder);
    return { url };
  }

  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
        .addFileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|gif|webp|svg\+xml)$/i })
        .build({
          fileIsRequired: true,
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        }),
    )
    file: { originalname: string; mimetype: string; buffer: Buffer },
  ) {
    const url = await this.imageUploadService.uploadImage(file);
    return { url };
  }

  private resolveAudioFolder(folder?: string): AudioUploadFolder {
    if (!folder || folder === 'chapters') {
      return 'chapters';
    }

    if (folder === 'bgm') {
      return 'bgm';
    }

    if (folder === 'music') {
      return 'music';
    }

    throw new BadRequestException('Invalid audio folder. Supported folders: chapters, bgm, music');
  }
}
