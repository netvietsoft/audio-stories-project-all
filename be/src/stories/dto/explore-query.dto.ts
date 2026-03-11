import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export const storySortOptions = ['latest', 'views', 'rating', 'title_asc', 'chapters_desc'] as const;
export type StorySortOption = (typeof storySortOptions)[number];

export const trendWindowOptions = ['all', 'today', 'week', 'month'] as const;
export type TrendWindowOption = (typeof trendWindowOptions)[number];

export class ExploreQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId?: number;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsIn(['ongoing', 'completed'])
  status?: 'ongoing' | 'completed';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(storySortOptions)
  sort?: StorySortOption = 'latest';

  @IsOptional()
  @IsString()
  all?: string;

  @IsOptional()
  @IsIn(trendWindowOptions)
  trendWindow?: TrendWindowOption = 'all';

  @IsOptional()
  @IsIn(['vi', 'en'])
  lang?: 'vi' | 'en';
}
