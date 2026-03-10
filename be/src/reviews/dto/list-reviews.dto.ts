import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum ReviewSortType {
  NEWEST = 'newest',
  HIGHEST = 'highest',
  HELPFUL = 'helpful',
}

export class ListReviewsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsEnum(ReviewSortType)
  sort?: ReviewSortType;
}
