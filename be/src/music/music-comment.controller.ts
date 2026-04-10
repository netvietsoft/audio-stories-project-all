import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { CreateMusicCommentDto } from './dto/create-music-comment.dto';
import { ListMusicCommentsDto } from './dto/list-music-comments.dto';
import { UpdateMusicCommentDto } from './dto/update-music-comment.dto';
import { MusicCommentService } from './music-comment.service';

@Controller('music')
export class MusicCommentController {
  constructor(private readonly musicCommentService: MusicCommentService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  private isAdmin(account: any) {
    const roles: string[] = Array.isArray(account?.roles) ? account.roles : [];
    return roles.some((role) => role.toUpperCase() === 'ADMIN');
  }

  @Get(':musicId/comments')
  listComments(@Param('musicId') musicId: string, @Query() query: ListMusicCommentsDto) {
    return this.musicCommentService.list(musicId, query);
  }

  @Post(':musicId/comments')
  @UseGuards(JwtAccessGuard)
  createComment(@Param('musicId') musicId: string, @Account() account: any, @Body() dto: CreateMusicCommentDto) {
    return this.musicCommentService.create(this.userIdFromAccount(account), musicId, dto);
  }

  @Patch('comments/:commentId')
  @UseGuards(JwtAccessGuard)
  updateComment(@Param('commentId') commentId: string, @Account() account: any, @Body() dto: UpdateMusicCommentDto) {
    return this.musicCommentService.update(this.userIdFromAccount(account), this.isAdmin(account), commentId, dto);
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAccessGuard)
  deleteComment(@Param('commentId') commentId: string, @Account() account: any) {
    return this.musicCommentService.remove(this.userIdFromAccount(account), this.isAdmin(account), commentId);
  }
}
