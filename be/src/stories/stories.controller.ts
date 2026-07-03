import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { ExploreQueryDto } from './dto/explore-query.dto';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateRecommendedDto } from './dto/update-recommended.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StoriesService } from './stories.service';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Account } from '@/auth/decorators/account.decorator';

@ApiTags('Stories')
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @ApiOperation({ summary: 'Tạo truyện mới (admin)' })
  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() createStoryDto: CreateStoryDto) {
    return this.storiesService.create(createStoryDto);
  }

  @ApiOperation({ summary: 'Khám phá danh sách truyện' })
  @Get()
  findAll(@Query() query: ExploreQueryDto) {
    return this.storiesService.exploreStories(query);
  }

  @ApiOperation({ summary: 'Danh sách truyện cho quản trị (admin)' })
  @Get('admin')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findAllAdmin(@Query() query: ExploreQueryDto) {
    return this.storiesService.findAllAdmin(query);
  }

  @ApiOperation({ summary: 'Chi tiết truyện theo id cho quản trị (admin)' })
  @Get('admin/:id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findOneAdmin(@Param('id') id: string) {
    return this.storiesService.findOneAdmin(id);
  }

  @ApiOperation({ summary: 'Lấy danh sách truyện trang chủ' })
  @Get('home')
  getHome() {
    return this.storiesService.getHomeStories();
  }

  @ApiOperation({ summary: 'Lấy danh sách thể loại' })
  @Get('categories')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('stories:categories')
  @CacheTTL(3600)
  getCategories(@Query('language') language = 'vi') {
    return this.storiesService.getAllCategories(language);
  }

  @ApiOperation({ summary: 'Lấy thể loại kèm số lượng truyện' })
  @Get('categories-with-count')
  getCategoriesWithCount(@Query('language') language = 'vi') {
    return this.storiesService.getAllCategoriesWithCount(language);
  }

  @ApiOperation({ summary: 'Lấy danh sách tác giả' })
  @Get('authors')
  getAuthors() {
    return this.storiesService.getAllAuthors();
  }

  @ApiOperation({ summary: 'Khám phá truyện theo bộ lọc' })
  @Get('explore')
  explore(@Query() query: ExploreQueryDto) {
    return this.storiesService.exploreStories(query);
  }

  @ApiOperation({ summary: 'Lấy danh sách truyện thịnh hành' })
  @Get('trending')
  trending(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('lang') lang = 'vi',
    @Query('trendWindow') trendWindow: 'today' | 'week' | 'month' | 'all' = 'week',
  ) {
    return this.storiesService.exploreStories({
      page: Number(page) || 1,
      limit: Number(limit) || 12,
      sort: 'views',
      lang,
      trendWindow,
    } as ExploreQueryDto);
  }

  @ApiOperation({ summary: 'Lấy danh sách truyện đề cử' })
  @Get('recommended')
  getRecommended(@Query('limit') limit?: string, @Query('lang') lang?: string) {
    return this.storiesService.getRecommendedStories(Number(limit) || 12, lang);
  }

  @ApiOperation({ summary: 'Lấy thể loại nổi bật' })
  @Get('categories/top')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('stories:categories:top:v2')
  @CacheTTL(3600)
  getTopCategories(@Query('limit') limit?: string, @Query('lang') lang = 'vi') {
    return this.storiesService.getTopCategories(Number(limit) || 6, lang);
  }

  @ApiOperation({ summary: 'Lấy danh sách truyện vinh danh' })
  @Get('hall-of-fame')
  getHallOfFame(@Query('limit') limit?: string) {
    return this.storiesService.getHallOfFame(Number(limit) || 3);
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái đề cử của truyện (admin)' })
  @Patch(':id/recommended')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  updateRecommended(@Param('id') id: string, @Body() dto: UpdateRecommendedDto) {
    return this.storiesService.updateRecommended(id, dto.isRecommended);
  }

  @ApiOperation({ summary: 'Cập nhật truyện theo id (admin)' })
  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  updateStory(@Param('id') id: string, @Body() dto: UpdateStoryDto) {
    return this.storiesService.updateStory(id, dto);
  }

  @ApiOperation({ summary: 'Xóa truyện theo id (admin)' })
  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  deleteStory(@Param('id') id: string) {
    return this.storiesService.deleteStory(id);
  }

  @ApiOperation({ summary: 'Tặng Pulse cho truyện' })
  @Post(':id/gift')
  @UseGuards(JwtAccessGuard)
  giftPulse(@Param('id') id: string, @Body() dto: { amount: number; message?: string; chapterId?: string }, @Account() user: any) {
    return this.storiesService.giftPulse(id, user.sub, dto.amount, dto.message, dto.chapterId);
  }

  @ApiOperation({ summary: 'Mở khóa truyện bằng Pulse' })
  @Post(':id/unlock')
  @UseGuards(JwtAccessGuard)
  unlockStory(@Param('id') id: string, @Account() user: any) {
    return this.storiesService.unlockStoryByPulse(id, user.sub);
  }

  // IMPORTANT: This must be LAST because it's a catch-all route
  @ApiOperation({ summary: 'Lấy chi tiết truyện theo slug' })
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.storiesService.getStoryDetail(slug);
  }
}
