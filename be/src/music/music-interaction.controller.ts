import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { ListMusicFavoritesDto } from './dto/list-music-favorites.dto';
import { ListMusicHistoryDto } from './dto/list-music-history.dto';
import { MusicInteractionService } from './music-interaction.service';

@Controller('music/interactions')
@UseGuards(JwtAccessGuard)
export class MusicInteractionController {
  constructor(private readonly interactionService: MusicInteractionService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @Get(':musicId/liked')
  getLikeStatus(@Param('musicId') musicId: string, @Account() account: any) {
    return this.interactionService.getLikeStatus(this.userIdFromAccount(account), musicId);
  }

  @Post(':musicId/like')
  like(@Param('musicId') musicId: string, @Account() account: any) {
    return this.interactionService.like(this.userIdFromAccount(account), musicId);
  }

  @Delete(':musicId/like')
  unlike(@Param('musicId') musicId: string, @Account() account: any) {
    return this.interactionService.unlike(this.userIdFromAccount(account), musicId);
  }

  @Post(':musicId/history')
  addHistory(@Param('musicId') musicId: string, @Account() account: any) {
    return this.interactionService.addHistory(this.userIdFromAccount(account), musicId);
  }

  @Get('history')
  listHistory(@Account() account: any, @Query() query: ListMusicHistoryDto) {
    return this.interactionService.listHistory(this.userIdFromAccount(account), query);
  }

  @Delete('history/:id')
  deleteHistoryEntry(@Param('id') id: string, @Account() account: any) {
    return this.interactionService.deleteHistoryEntry(this.userIdFromAccount(account), id);
  }

  @Delete('history')
  clearHistory(@Account() account: any) {
    return this.interactionService.clearHistory(this.userIdFromAccount(account));
  }

  @Get('favorites')
  listFavorites(@Account() account: any, @Query() query: ListMusicFavoritesDto) {
    return this.interactionService.listFavorites(this.userIdFromAccount(account), query);
  }
}
