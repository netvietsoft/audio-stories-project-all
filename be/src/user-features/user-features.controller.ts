import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { ExploreQueryDto } from '@/stories/dto/explore-query.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import { SyncHistoryDto } from './dto/sync-history.dto';
import { ToggleFavoriteDto } from './dto/toggle-favorite.dto';
import { UserFeaturesService } from './user-features.service';

@Controller()
@UseGuards(JwtAccessGuard)
export class UserFeaturesController {
  constructor(private readonly userFeaturesService: UserFeaturesService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @Post('favorites/toggle')
  toggleFavorite(@Account() account: any, @Body() dto: ToggleFavoriteDto) {
    return this.userFeaturesService.toggleFavorite(this.userIdFromAccount(account), dto.storyId);
  }

  @Get('favorites')
  getFavorites(@Account() account: any, @Query() query: ExploreQueryDto) {
    return this.userFeaturesService.getFavorites(this.userIdFromAccount(account), query);
  }

  @Get('story-subscriptions/:storyId/status')
  getStorySubscriptionStatus(@Account() account: any, @Param('storyId') storyId: string) {
    return this.userFeaturesService.getStorySubscriptionStatus(this.userIdFromAccount(account), storyId);
  }

  @Post('story-subscriptions/:storyId/toggle')
  toggleStorySubscription(@Account() account: any, @Param('storyId') storyId: string) {
    return this.userFeaturesService.toggleStorySubscription(this.userIdFromAccount(account), storyId);
  }

  @Post('history/sync')
  syncHistory(@Account() account: any, @Body() dto: SyncHistoryDto) {
    return this.userFeaturesService.syncHistory(this.userIdFromAccount(account), dto);
  }

  @Get('history')
  getHistory(@Account() account: any, @Query() query: HistoryQueryDto) {
    return this.userFeaturesService.getHistory(this.userIdFromAccount(account), query);
  }

  @Get('unlocked-stories')
  getUnlockedStories(@Account() account: any, @Query() query: HistoryQueryDto) {
    return this.userFeaturesService.getUnlockedStories(this.userIdFromAccount(account), query);
  }

  @Delete('history/:id')
  deleteHistoryItem(@Account() account: any, @Param('id') id: string) {
    return this.userFeaturesService.deleteHistoryItem(this.userIdFromAccount(account), id);
  }

  @Delete('history')
  clearHistory(@Account() account: any) {
    return this.userFeaturesService.clearHistory(this.userIdFromAccount(account));
  }
}
