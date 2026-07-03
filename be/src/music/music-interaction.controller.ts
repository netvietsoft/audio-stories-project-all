import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { ListMusicFavoritesDto } from './dto/list-music-favorites.dto';
import { ListMusicHistoryDto } from './dto/list-music-history.dto';
import { UpdateMusicHistoryProgressDto } from './dto/update-music-history-progress.dto';
import { MusicInteractionService } from './music-interaction.service';

@ApiTags('Music Interaction')
@Controller('music/interactions')
@UseGuards(JwtAccessGuard)
export class MusicInteractionController {
  constructor(private readonly interactionService: MusicInteractionService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @ApiOperation({ summary: 'Kiểm tra trạng thái đã thích bản nhạc' })
  @Get(':musicId/liked')
  getLikeStatus(@Param('musicId') musicId: string, @Account() account: any) {
    return this.interactionService.getLikeStatus(this.userIdFromAccount(account), musicId);
  }

  @ApiOperation({ summary: 'Thích bản nhạc' })
  @Post(':musicId/like')
  like(@Param('musicId') musicId: string, @Account() account: any) {
    return this.interactionService.like(this.userIdFromAccount(account), musicId);
  }

  @ApiOperation({ summary: 'Bỏ thích bản nhạc' })
  @Delete(':musicId/like')
  unlike(@Param('musicId') musicId: string, @Account() account: any) {
    return this.interactionService.unlike(this.userIdFromAccount(account), musicId);
  }

  @ApiOperation({ summary: 'Thêm bản nhạc vào lịch sử nghe' })
  @Post(':musicId/history')
  addHistory(@Param('musicId') musicId: string, @Account() account: any) {
    return this.interactionService.addHistory(this.userIdFromAccount(account), musicId);
  }

  @ApiOperation({ summary: 'Kiểm tra quyền truy cập bản nhạc' })
  @Get(':musicId/access')
  getAccessStatus(@Param('musicId') musicId: string, @Account() account: any) {
    return this.interactionService.getAccessStatus(this.userIdFromAccount(account), musicId);
  }

  @ApiOperation({ summary: 'Mở khóa bản nhạc' })
  @Post(':musicId/unlock')
  unlockMusic(@Param('musicId') musicId: string, @Account() account: any) {
    return this.interactionService.unlockMusic(this.userIdFromAccount(account), musicId);
  }

  @ApiOperation({ summary: 'Cập nhật tiến độ nghe trong lịch sử' })
  @Patch(':musicId/history')
  updateHistoryProgress(
    @Param('musicId') musicId: string,
    @Body() dto: UpdateMusicHistoryProgressDto,
    @Account() account: any,
  ) {
    return this.interactionService.updateHistoryProgress(this.userIdFromAccount(account), musicId, dto.progressSeconds);
  }

  @ApiOperation({ summary: 'Danh sách lịch sử nghe' })
  @Get('history')
  listHistory(@Account() account: any, @Query() query: ListMusicHistoryDto) {
    return this.interactionService.listHistory(this.userIdFromAccount(account), query);
  }

  @ApiOperation({ summary: 'Danh sách bản nhạc đã mở khóa' })
  @Get('unlocked')
  listUnlocked(@Account() account: any, @Query() query: ListMusicHistoryDto) {
    return this.interactionService.listUnlocked(this.userIdFromAccount(account), query);
  }

  @ApiOperation({ summary: 'Xóa một mục trong lịch sử nghe' })
  @Delete('history/:id')
  deleteHistoryEntry(@Param('id') id: string, @Account() account: any) {
    return this.interactionService.deleteHistoryEntry(this.userIdFromAccount(account), id);
  }

  @ApiOperation({ summary: 'Xóa toàn bộ lịch sử nghe' })
  @Delete('history')
  clearHistory(@Account() account: any) {
    return this.interactionService.clearHistory(this.userIdFromAccount(account));
  }

  @ApiOperation({ summary: 'Danh sách bản nhạc yêu thích' })
  @Get('favorites')
  listFavorites(@Account() account: any, @Query() query: ListMusicFavoritesDto) {
    return this.interactionService.listFavorites(this.userIdFromAccount(account), query);
  }
}
