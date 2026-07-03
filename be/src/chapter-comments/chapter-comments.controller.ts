import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { Account } from '@/auth/decorators/account.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { CreateChapterCommentDto } from './dto/create-chapter-comment.dto';
import { ListRepliesDto } from './dto/list-replies.dto';
import { ListChapterCommentsDto } from './dto/list-chapter-comments.dto';
import { ToggleCommentReactionDto } from './dto/toggle-comment-reaction.dto';
import { CreateCommentReportDto } from './dto/create-comment-report.dto';
import { ListCommentReportsDto } from './dto/list-comment-reports.dto';
import { UpdateCommentReportDto } from './dto/update-comment-report.dto';
import { ChapterCommentsService } from './chapter-comments.service';

@ApiTags('Chapter Comments')
@Controller()
export class ChapterCommentsController {
  constructor(private readonly chapterCommentsService: ChapterCommentsService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @ApiOperation({ summary: 'Đếm số bình luận của chương' })
  @Get('chapters/:chapterId/comments/counts')
  getCounts(@Param('chapterId') chapterId: string) {
    return this.chapterCommentsService.getCommentCounts(chapterId);
  }

  @ApiOperation({ summary: 'Lấy danh sách bình luận của chương' })
  @Get('chapters/:chapterId/comments')
  list(@Param('chapterId') chapterId: string, @Query() query: ListChapterCommentsDto) {
    return this.chapterCommentsService.list(chapterId, query);
  }

  @ApiOperation({ summary: 'Tạo bình luận cho chương' })
  @Post('chapters/:chapterId/comments')
  @UseGuards(JwtAccessGuard)
  create(
    @Param('chapterId') chapterId: string,
    @Account() account: any,
    @Body() dto: CreateChapterCommentDto,
  ) {
    return this.chapterCommentsService.create(this.userIdFromAccount(account), chapterId, dto);
  }

  @ApiOperation({ summary: 'Lấy danh sách phản hồi của bình luận' })
  @Get('comments/:commentId/replies')
  listReplies(@Param('commentId') commentId: string, @Query() query: ListRepliesDto) {
    return this.chapterCommentsService.listReplies(commentId, query);
  }

  @ApiOperation({ summary: 'Bật/tắt cảm xúc cho bình luận' })
  @Post('comments/:commentId/reactions')
  @UseGuards(JwtAccessGuard)
  toggleReaction(
    @Param('commentId') commentId: string,
    @Account() account: any,
    @Body() dto: ToggleCommentReactionDto,
  ) {
    return this.chapterCommentsService.toggleReaction(this.userIdFromAccount(account), commentId, dto.type);
  }

  @ApiOperation({ summary: 'Báo cáo bình luận vi phạm' })
  @Post('comments/:commentId/report')
  @UseGuards(JwtAccessGuard)
  reportComment(
    @Param('commentId') commentId: string,
    @Account() account: any,
    @Body() dto: CreateCommentReportDto,
  ) {
    return this.chapterCommentsService.reportComment(
      this.userIdFromAccount(account),
      commentId,
      dto.reason,
    );
  }

  @ApiOperation({ summary: 'Lấy danh sách báo cáo bình luận (admin)' })
  @Get('comments/reports')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  listReports(@Query() query: ListCommentReportsDto) {
    return this.chapterCommentsService.listReports(query);
  }

  @ApiOperation({ summary: 'Thống kê báo cáo bình luận (admin)' })
  @Get('comments/reports/stats')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  getReportStats() {
    return this.chapterCommentsService.getReportStats();
  }

  @ApiOperation({ summary: 'Cập nhật trạng thái báo cáo bình luận (admin)' })
  @Patch('comments/reports/:reportId')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  updateReport(@Param('reportId') reportId: string, @Body() dto: UpdateCommentReportDto) {
    return this.chapterCommentsService.updateReport(reportId, dto);
  }
}

