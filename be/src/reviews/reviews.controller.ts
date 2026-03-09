import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { CreateReviewDto } from './dto/create-review.dto';
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
  listReviews(@Param('storyId') storyId: string, @Query() query: ListReviewsDto) {
    return this.reviewsService.listReviews(storyId, query);
  }

  @Post('reviews')
  @UseGuards(JwtAccessGuard)
  upsertReview(@Param('storyId') storyId: string, @Account() account: any, @Body() dto: CreateReviewDto) {
    return this.reviewsService.upsertReview(storyId, this.userIdFromAccount(account), dto);
  }
}
