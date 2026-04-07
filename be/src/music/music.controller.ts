import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { CreateMusicDto } from './dto/create-music.dto';
import { MusicQueryDto } from './dto/music-query.dto';
import { UpdateMusicDto } from './dto/update-music.dto';
import { MusicService } from './music.service';

type UploadFiles = {
  audioFile?: Express.Multer.File[];
  thumbnailFile?: Express.Multer.File[];
};

const MUSIC_INTERCEPTOR = FileFieldsInterceptor(
  [
    { name: 'audioFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
  ],
  {
    storage: memoryStorage(),
    limits: {
      fileSize: 120 * 1024 * 1024,
      files: 2,
    },
  },
);

@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  @Get()
  findPublic(@Query() query: MusicQueryDto) {
    return this.musicService.findPublic(query);
  }

  @Get('admin')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findAllAdmin(@Query() query: MusicQueryDto) {
    return this.musicService.findAllAdmin(query);
  }

  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(MUSIC_INTERCEPTOR)
  create(@Body() dto: CreateMusicDto, @UploadedFiles() files: UploadFiles) {
    this.validateUploadFiles(files);
    return this.musicService.create(dto, files);
  }

  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(MUSIC_INTERCEPTOR)
  update(@Param('id') id: string, @Body() dto: UpdateMusicDto, @UploadedFiles() files: UploadFiles) {
    this.validateUploadFiles(files);
    return this.musicService.update(id, dto, files);
  }

  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.musicService.remove(id);
  }

  private validateUploadFiles(files: UploadFiles) {
    const audio = files.audioFile?.[0];
    const thumbnail = files.thumbnailFile?.[0];

    if (audio && !audio.mimetype.startsWith('audio/')) {
      throw new BadRequestException('audioFile must be an audio file.');
    }

    if (thumbnail && !thumbnail.mimetype.startsWith('image/')) {
      throw new BadRequestException('thumbnailFile must be an image file.');
    }
  }
}
