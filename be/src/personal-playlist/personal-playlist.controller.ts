import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { CreatePersonalPlaylistDto } from './dto/create-personal-playlist.dto';
import { UpdatePersonalPlaylistDto } from './dto/update-personal-playlist.dto';
import { PersonalPlaylistService } from './personal-playlist.service';

@Controller('personal-playlists')
@UseGuards(JwtAccessGuard)
export class PersonalPlaylistController {
  constructor(private readonly personalPlaylistService: PersonalPlaylistService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @Post()
  create(@Account() account: any, @Body() dto: CreatePersonalPlaylistDto) {
    return this.personalPlaylistService.create(this.userIdFromAccount(account), dto);
  }

  @Get()
  listMine(@Account() account: any) {
    return this.personalPlaylistService.listMine(this.userIdFromAccount(account));
  }

  @Get(':id')
  getDetail(@Account() account: any, @Param('id') playlistId: string) {
    return this.personalPlaylistService.getDetail(this.userIdFromAccount(account), playlistId);
  }

  @Patch(':id')
  updateTitle(@Account() account: any, @Param('id') playlistId: string, @Body() dto: UpdatePersonalPlaylistDto) {
    return this.personalPlaylistService.updateTitle(this.userIdFromAccount(account), playlistId, dto);
  }

  @Post(':id/tracks/:musicId')
  addTrack(@Account() account: any, @Param('id') playlistId: string, @Param('musicId') musicId: string) {
    return this.personalPlaylistService.addTrack(this.userIdFromAccount(account), playlistId, musicId);
  }

  @Delete(':id/tracks/:musicId')
  removeTrack(@Account() account: any, @Param('id') playlistId: string, @Param('musicId') musicId: string) {
    return this.personalPlaylistService.removeTrack(this.userIdFromAccount(account), playlistId, musicId);
  }

  @Delete(':id')
  removePlaylist(@Account() account: any, @Param('id') playlistId: string) {
    return this.personalPlaylistService.removePlaylist(this.userIdFromAccount(account), playlistId);
  }
}
