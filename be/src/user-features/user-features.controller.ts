import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { ExploreQueryDto } from '@/stories/dto/explore-query.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import { SyncHistoryDto } from './dto/sync-history.dto';
import { ToggleFavoriteDto } from './dto/toggle-favorite.dto';
import { UserFeaturesService } from './user-features.service';

@ApiTags('User Features')
@Controller()
@UseGuards(JwtAccessGuard)
export class UserFeaturesController {
  constructor(private readonly userFeaturesService: UserFeaturesService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @ApiOperation({ summary: 'Bật/tắt yêu thích truyện' })
  @Post('favorites/toggle')
  toggleFavorite(@Account() account: any, @Body() dto: ToggleFavoriteDto) {
    return this.userFeaturesService.toggleFavorite(this.userIdFromAccount(account), dto.storyId);
  }

  @ApiOperation({ summary: 'Lấy danh sách truyện yêu thích' })
  @Get('favorites')
  getFavorites(@Account() account: any, @Query() query: ExploreQueryDto) {
    return this.userFeaturesService.getFavorites(this.userIdFromAccount(account), query);
  }

  @ApiOperation({ summary: 'Kiểm tra trạng thái theo dõi truyện' })
  @Get('story-subscriptions/:storyId/status')
  getStorySubscriptionStatus(@Account() account: any, @Param('storyId') storyId: string) {
    return this.userFeaturesService.getStorySubscriptionStatus(this.userIdFromAccount(account), storyId);
  }

  @ApiOperation({ summary: 'Bật/tắt theo dõi truyện' })
  @Post('story-subscriptions/:storyId/toggle')
  toggleStorySubscription(@Account() account: any, @Param('storyId') storyId: string) {
    return this.userFeaturesService.toggleStorySubscription(this.userIdFromAccount(account), storyId);
  }

  @ApiOperation({ summary: 'Đồng bộ lịch sử đọc' })
  @Post('history/sync')
  syncHistory(@Account() account: any, @Body() dto: SyncHistoryDto) {
    return this.userFeaturesService.syncHistory(this.userIdFromAccount(account), dto);
  }

  @ApiOperation({ summary: 'Lấy lịch sử đọc' })
  @Get('history')
  getHistory(@Account() account: any, @Query() query: HistoryQueryDto) {
    return this.userFeaturesService.getHistory(this.userIdFromAccount(account), query);
  }

  @ApiOperation({ summary: 'Lấy danh sách truyện đã mở khóa' })
  @Get('unlocked-stories')
  getUnlockedStories(@Account() account: any, @Query() query: HistoryQueryDto) {
    return this.userFeaturesService.getUnlockedStories(this.userIdFromAccount(account), query);
  }

  @ApiOperation({ summary: 'Xóa một mục lịch sử đọc theo id' })
  @Delete('history/:id')
  deleteHistoryItem(@Account() account: any, @Param('id') id: string) {
    return this.userFeaturesService.deleteHistoryItem(this.userIdFromAccount(account), id);
  }

  @ApiOperation({ summary: 'Xóa toàn bộ lịch sử đọc' })
  @Delete('history')
  clearHistory(@Account() account: any) {
    return this.userFeaturesService.clearHistory(this.userIdFromAccount(account));
  }
}
