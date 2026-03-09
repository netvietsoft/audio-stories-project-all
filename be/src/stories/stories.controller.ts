import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Service, type UploadFilePayload } from '@/upload/s3.service';



import { ExploreQueryDto } from './dto/explore-query.dto';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoriesService } from './stories.service';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@Controller('stories')
export class StoriesController {
  constructor(
    private readonly storiesService: StoriesService,
    private readonly s3Service: S3Service,
  ) { }

  @Post('upload-audio')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAudio(@UploadedFile() file: UploadFilePayload) {
    const url = await this.s3Service.uploadFile(file, 'audio-stories');
    return { url };
  }




  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() createStoryDto: CreateStoryDto) {
    return this.storiesService.create(createStoryDto);
  }

  @Get('admin')

  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findAllAdmin(@Query() query: ExploreQueryDto) {
    return this.storiesService.findAllAdmin(query);
  }

  @Get('home')
  getHome() {
    return this.storiesService.getHomeStories();
  }

  @Get('categories')
  getCategories() {
    return this.storiesService.getAllCategories();
  }

  @Get('authors')
  getAuthors() {
    return this.storiesService.getAllAuthors();
  }

  @Get('explore')
  explore(@Query() query: ExploreQueryDto) {
    return this.storiesService.exploreStories(query);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.storiesService.getStoryDetail(slug);
  }
}
