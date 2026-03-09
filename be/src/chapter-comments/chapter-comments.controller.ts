import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { CreateChapterCommentDto } from './dto/create-chapter-comment.dto';
import { ListRepliesDto } from './dto/list-replies.dto';
import { ListChapterCommentsDto } from './dto/list-chapter-comments.dto';
import { ToggleCommentReactionDto } from './dto/toggle-comment-reaction.dto';
import { ChapterCommentsService } from './chapter-comments.service';

@Controller()
export class ChapterCommentsController {
  constructor(private readonly chapterCommentsService: ChapterCommentsService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @Get('chapters/:chapterId/comments')
  list(@Param('chapterId') chapterId: string, @Query() query: ListChapterCommentsDto) {
    return this.chapterCommentsService.list(chapterId, query);
  }

  @Post('chapters/:chapterId/comments')
  @UseGuards(JwtAccessGuard)
  create(
    @Param('chapterId') chapterId: string,
    @Account() account: any,
    @Body() dto: CreateChapterCommentDto,
  ) {
    return this.chapterCommentsService.create(this.userIdFromAccount(account), chapterId, dto);
  }

  @Get('comments/:commentId/replies')
  listReplies(@Param('commentId') commentId: string, @Query() query: ListRepliesDto) {
    return this.chapterCommentsService.listReplies(commentId, query);
  }

  @Post('comments/:commentId/reactions')
  @UseGuards(JwtAccessGuard)
  toggleReaction(
    @Param('commentId') commentId: string,
    @Account() account: any,
    @Body() dto: ToggleCommentReactionDto,
  ) {
    return this.chapterCommentsService.toggleReaction(this.userIdFromAccount(account), commentId, dto.type);
  }
}
