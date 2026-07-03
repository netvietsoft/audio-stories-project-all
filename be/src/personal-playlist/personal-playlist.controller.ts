import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { CreatePersonalPlaylistDto } from './dto/create-personal-playlist.dto';
import { UpdatePersonalPlaylistDto } from './dto/update-personal-playlist.dto';
import { PersonalPlaylistService } from './personal-playlist.service';

@ApiTags('Personal Playlist')
@Controller('personal-playlists')
@UseGuards(JwtAccessGuard)
export class PersonalPlaylistController {
  constructor(private readonly personalPlaylistService: PersonalPlaylistService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @ApiOperation({ summary: 'Tạo playlist cá nhân' })
  @Post()
  create(@Account() account: any, @Body() dto: CreatePersonalPlaylistDto) {
    return this.personalPlaylistService.create(this.userIdFromAccount(account), dto);
  }

  @ApiOperation({ summary: 'Danh sách playlist của tôi' })
  @Get()
  listMine(@Account() account: any) {
    return this.personalPlaylistService.listMine(this.userIdFromAccount(account));
  }

  @ApiOperation({ summary: 'Chi tiết playlist cá nhân' })
  @Get(':id')
  getDetail(@Account() account: any, @Param('id') playlistId: string) {
    return this.personalPlaylistService.getDetail(this.userIdFromAccount(account), playlistId);
  }

  @ApiOperation({ summary: 'Cập nhật tiêu đề playlist' })
  @Patch(':id')
  updateTitle(@Account() account: any, @Param('id') playlistId: string, @Body() dto: UpdatePersonalPlaylistDto) {
    return this.personalPlaylistService.updateTitle(this.userIdFromAccount(account), playlistId, dto);
  }

  @ApiOperation({ summary: 'Thêm bản nhạc vào playlist' })
  @Post(':id/tracks/:musicId')
  addTrack(@Account() account: any, @Param('id') playlistId: string, @Param('musicId') musicId: string) {
    return this.personalPlaylistService.addTrack(this.userIdFromAccount(account), playlistId, musicId);
  }

  @ApiOperation({ summary: 'Xóa bản nhạc khỏi playlist' })
  @Delete(':id/tracks/:musicId')
  removeTrack(@Account() account: any, @Param('id') playlistId: string, @Param('musicId') musicId: string) {
    return this.personalPlaylistService.removeTrack(this.userIdFromAccount(account), playlistId, musicId);
  }

  @ApiOperation({ summary: 'Xóa playlist cá nhân' })
  @Delete(':id')
  removePlaylist(@Account() account: any, @Param('id') playlistId: string) {
    return this.personalPlaylistService.removePlaylist(this.userIdFromAccount(account), playlistId);
  }
}
