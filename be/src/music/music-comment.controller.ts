import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { MusicCommentService } from './music-comment.service';

@Controller('music')
export class MusicCommentController {
  constructor(private readonly commentService: MusicCommentService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @Get(':musicId/comments')
  listComments(
    @Param('musicId') musicId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.commentService.listComments(musicId, {
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(50, Math.max(1, Number(limit) || 10)),
      sort: sort === 'oldest' ? 'oldest' : 'newest',
    });
  }

  @Post(':musicId/comments')
  @UseGuards(JwtAccessGuard)
  createComment(
    @Param('musicId') musicId: string,
    @Account() account: any,
    @Body('content') content: string,
  ) {
    return this.commentService.createComment(this.userIdFromAccount(account), musicId, content);
  }

  @Post('comments/:commentId/reply')
  @UseGuards(JwtAccessGuard)
  replyComment(
    @Param('commentId') commentId: string,
    @Account() account: any,
    @Body('content') content: string,
  ) {
    return this.commentService.replyComment(this.userIdFromAccount(account), commentId, content);
  }

  @Post('comments/:commentId/like')
  @UseGuards(JwtAccessGuard)
  likeComment(
    @Param('commentId') commentId: string,
    @Account() account: any,
  ) {
    return this.commentService.likeComment(this.userIdFromAccount(account), commentId);
  }

  @Delete('comments/:commentId/like')
  @UseGuards(JwtAccessGuard)
  unlikeComment(
    @Param('commentId') commentId: string,
    @Account() account: any,
  ) {
    return this.commentService.unlikeComment(this.userIdFromAccount(account), commentId);
  }

  @Patch('comments/:commentId')
  @UseGuards(JwtAccessGuard)
  updateComment(
    @Param('commentId') commentId: string,
    @Account() account: any,
    @Body('content') content: string,
  ) {
    return this.commentService.updateComment(this.userIdFromAccount(account), commentId, content);
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAccessGuard)
  deleteComment(@Param('commentId') commentId: string, @Account() account: any) {
    return this.commentService.deleteComment(this.userIdFromAccount(account), commentId);
  }
}
