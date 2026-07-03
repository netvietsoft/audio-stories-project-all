import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { MusicCommentService } from './music-comment.service';

@ApiTags('Music Comments')
@Controller('music')
export class MusicCommentController {
  constructor(private readonly commentService: MusicCommentService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @ApiOperation({ summary: 'Danh sách bình luận của bản nhạc' })
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

  @ApiOperation({ summary: 'Tạo bình luận cho bản nhạc' })
  @Post(':musicId/comments')
  @UseGuards(JwtAccessGuard)
  createComment(
    @Param('musicId') musicId: string,
    @Account() account: any,
    @Body('content') content: string,
  ) {
    return this.commentService.createComment(this.userIdFromAccount(account), musicId, content);
  }

  @ApiOperation({ summary: 'Trả lời bình luận' })
  @Post('comments/:commentId/reply')
  @UseGuards(JwtAccessGuard)
  replyComment(
    @Param('commentId') commentId: string,
    @Account() account: any,
    @Body('content') content: string,
  ) {
    return this.commentService.replyComment(this.userIdFromAccount(account), commentId, content);
  }

  @ApiOperation({ summary: 'Thích bình luận' })
  @Post('comments/:commentId/like')
  @UseGuards(JwtAccessGuard)
  likeComment(
    @Param('commentId') commentId: string,
    @Account() account: any,
  ) {
    return this.commentService.likeComment(this.userIdFromAccount(account), commentId);
  }

  @ApiOperation({ summary: 'Bỏ thích bình luận' })
  @Delete('comments/:commentId/like')
  @UseGuards(JwtAccessGuard)
  unlikeComment(
    @Param('commentId') commentId: string,
    @Account() account: any,
  ) {
    return this.commentService.unlikeComment(this.userIdFromAccount(account), commentId);
  }

  @ApiOperation({ summary: 'Cập nhật nội dung bình luận' })
  @Patch('comments/:commentId')
  @UseGuards(JwtAccessGuard)
  updateComment(
    @Param('commentId') commentId: string,
    @Account() account: any,
    @Body('content') content: string,
  ) {
    return this.commentService.updateComment(this.userIdFromAccount(account), commentId, content);
  }

  @ApiOperation({ summary: 'Xóa bình luận' })
  @Delete('comments/:commentId')
  @UseGuards(JwtAccessGuard)
  deleteComment(@Param('commentId') commentId: string, @Account() account: any) {
    return this.commentService.deleteComment(this.userIdFromAccount(account), commentId);
  }
}
