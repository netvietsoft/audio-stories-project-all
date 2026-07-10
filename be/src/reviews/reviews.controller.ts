import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { clientIp } from '@/common/geo/geo.util';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateReviewReplyDto } from './dto/create-review-reply.dto';
import { ListReviewRepliesDto } from './dto/list-review-replies.dto';
import { ListReviewsDto } from './dto/list-reviews.dto';
import { ReviewsService } from './reviews.service';

@Controller('stories/:storyId')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @Get('rating-stats')
  getRatingStats(@Param('storyId') storyId: string) {
    return this.reviewsService.getRatingStats(storyId);
  }

  @Get('reviews')
  listReviews(@Param('storyId') storyId: string, @Query() query: ListReviewsDto, @Account() account?: any) {
    return this.reviewsService.listReviews(storyId, query, this.userIdFromAccount(account));
  }

  @Post('reviews')
  @UseGuards(JwtAccessGuard)
  upsertReview(
    @Param('storyId') storyId: string,
    @Account() account: any,
    @Body() dto: CreateReviewDto,
    @Req() req: Request,
  ) {
    return this.reviewsService.upsertReview(storyId, this.userIdFromAccount(account), dto, clientIp(req));
  }

  @Post('reviews/:reviewId/like')
  @UseGuards(JwtAccessGuard)
  toggleLike(@Param('reviewId') reviewId: string, @Account() account: any) {
    return this.reviewsService.toggleLike(reviewId, this.userIdFromAccount(account));
  }

  @Post('reviews/:reviewId/helpful')
  @UseGuards(JwtAccessGuard)
  toggleHelpful(@Param('reviewId') reviewId: string, @Account() account: any) {
    return this.reviewsService.toggleHelpful(reviewId, this.userIdFromAccount(account));
  }

  @Get('reviews/:reviewId/replies')
  listReplies(@Param('reviewId') reviewId: string, @Query() query: ListReviewRepliesDto) {
    return this.reviewsService.listReplies(reviewId, query);
  }

  @Post('reviews/:reviewId/replies')
  @UseGuards(JwtAccessGuard)
  createReply(@Param('reviewId') reviewId: string, @Account() account: any, @Body() dto: CreateReviewReplyDto) {
    return this.reviewsService.createReply(reviewId, this.userIdFromAccount(account), dto);
  }
}
