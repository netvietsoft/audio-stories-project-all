import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

import { ExploreQueryDto } from './dto/explore-query.dto';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateRecommendedDto } from './dto/update-recommended.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StoriesService } from './stories.service';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Account } from '@/auth/decorators/account.decorator';

@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() createStoryDto: CreateStoryDto) {
    return this.storiesService.create(createStoryDto);
  }

  @Get()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findAll(@Query() query: ExploreQueryDto) {
    return this.storiesService.findAllAdmin(query);
  }

  @Get('admin')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findAllAdmin(@Query() query: ExploreQueryDto) {
    return this.storiesService.findAllAdmin(query);
  }

  @Get('admin/:id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findOneAdmin(@Param('id') id: string) {
    return this.storiesService.findOneAdmin(id);
  }

  @Get('home')
  getHome() {
    return this.storiesService.getHomeStories();
  }

  @Get('categories')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('stories:categories')
  @CacheTTL(3600)
  getCategories(@Query('language') language = 'vi') {
    return this.storiesService.getAllCategories(language);
  }

  @Get('categories-with-count')
  getCategoriesWithCount(@Query('language') language = 'vi') {
    return this.storiesService.getAllCategoriesWithCount(language);
  }

  @Get('authors')
  getAuthors() {
    return this.storiesService.getAllAuthors();
  }

  @Get('explore')
  explore(@Query() query: ExploreQueryDto) {
    return this.storiesService.exploreStories(query);
  }

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

  @Get('recommended')
  getRecommended(@Query('limit') limit?: string) {
    return this.storiesService.getRecommendedStories(Number(limit) || 12);
  }

  @Get('categories/top')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3600)
  getTopCategories(@Query('limit') limit?: string, @Query('lang') lang = 'vi') {
    return this.storiesService.getTopCategories(Number(limit) || 5, lang);
  }

  @Get('hall-of-fame')
  getHallOfFame(@Query('limit') limit?: string) {
    return this.storiesService.getHallOfFame(Number(limit) || 3);
  }

  @Patch(':id/recommended')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  updateRecommended(@Param('id') id: string, @Body() dto: UpdateRecommendedDto) {
    return this.storiesService.updateRecommended(id, dto.isRecommended);
  }

  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  updateStory(@Param('id') id: string, @Body() dto: UpdateStoryDto) {
    return this.storiesService.updateStory(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  deleteStory(@Param('id') id: string) {
    return this.storiesService.deleteStory(id);
  }

  @Post(':id/gift')
  @UseGuards(JwtAccessGuard)
  giftCredits(@Param('id') id: string, @Body() dto: { amount: number; message?: string; chapterId?: string }, @Account() user: any) {
    return this.storiesService.giftCredits(id, user.sub, dto.amount, dto.message, dto.chapterId);
  }

  // IMPORTANT: This must be LAST because it's a catch-all route
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.storiesService.getStoryDetail(slug);
  }
}
