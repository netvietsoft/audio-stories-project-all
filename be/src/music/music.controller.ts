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
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { OptionalJwtGuard } from '@/auth/guards/optional-jwt.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { CreateMusicDto } from './dto/create-music.dto';
import { MusicQueryDto } from './dto/music-query.dto';
import { UpdateMusicDto } from './dto/update-music.dto';
import { MusicService } from './music.service';

type UploadFiles = {
  audioFile?: Express.Multer.File[];
  thumbnailFile?: Express.Multer.File[];
};

// Audio có thể là file dài / bitrate cao (vd audiobook) -> cho tới 500MB.
// LƯU Ý: memoryStorage giữ NGUYÊN file trong RAM khi upload; nếu cần lớn hơn nữa nên đổi sang
// stream ra disk + multipart upload R2 thay vì buffer. Prod cần nới client_max_body_size ở nginx.
const MAX_AUDIO_UPLOAD_BYTES = 500 * 1024 * 1024;

const MUSIC_INTERCEPTOR = FileFieldsInterceptor(
  [
    { name: 'audioFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
  ],
  {
    storage: memoryStorage(),
    limits: {
      fileSize: MAX_AUDIO_UPLOAD_BYTES,
      files: 2,
    },
  },
);

@ApiTags('Music')
@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  @ApiOperation({ summary: 'Danh sách nhạc công khai' })
  @Get()
  @UseGuards(OptionalJwtGuard)
  findPublic(@Query() query: MusicQueryDto, @Req() req: Request) {
    const userId = (req.user as { id?: string } | undefined)?.id;
    return this.musicService.findPublic(query, { userId });
  }

  @ApiOperation({ summary: 'Danh sách tất cả nhạc (admin)' })
  @Get('admin')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findAllAdmin(@Query() query: MusicQueryDto) {
    return this.musicService.findAllAdmin(query);
  }

  @ApiOperation({ summary: 'Danh sách nhạc liên quan theo slug' })
  @Get(':slug/related')
  @UseGuards(OptionalJwtGuard)
  findRelatedPublic(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit);
    const userId = (req.user as { id?: string } | undefined)?.id;
    return this.musicService.findRelatedPublic(
      slug,
      Number.isFinite(parsedLimit) ? parsedLimit : 8,
      { userId },
    );
  }

  @ApiOperation({ summary: 'Tạo bản nhạc mới kèm upload file (admin)' })
  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(MUSIC_INTERCEPTOR)
  create(@Body() dto: CreateMusicDto, @UploadedFiles() files?: UploadFiles) {
    this.validateUploadFiles(files);
    return this.musicService.create(dto, files || {});
  }

  @ApiOperation({ summary: 'Cập nhật bản nhạc kèm upload file (admin)' })
  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(MUSIC_INTERCEPTOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMusicDto,
    @UploadedFiles() files?: UploadFiles,
  ) {
    this.validateUploadFiles(files);
    return this.musicService.update(id, dto, files || {});
  }

  @ApiOperation({ summary: 'Xóa bản nhạc (admin)' })
  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.musicService.remove(id);
  }

  @ApiOperation({ summary: 'Chi tiết bản nhạc theo slug' })
  @Get(':slug')
  @UseGuards(OptionalJwtGuard)
  findOnePublic(@Param('slug') slug: string, @Req() req: Request) {
    const userId = (req.user as { id?: string } | undefined)?.id;
    return this.musicService.findOnePublic(slug, { userId });
  }

  @ApiOperation({ summary: 'Tăng lượt nghe bản nhạc' })
  @Post(':id/play')
  incrementPlayCount(@Param('id') id: string) {
    return this.musicService.incrementPlayCount(id);
  }

  private validateUploadFiles(files?: UploadFiles) {
    const audio = files?.audioFile?.[0];
    const thumbnail = files?.thumbnailFile?.[0];

    if (audio && !audio.mimetype.startsWith('audio/')) {
      throw new BadRequestException('audioFile must be an audio file.');
    }

    if (thumbnail && !thumbnail.mimetype.startsWith('image/')) {
      throw new BadRequestException('thumbnailFile must be an image file.');
    }
  }
}
