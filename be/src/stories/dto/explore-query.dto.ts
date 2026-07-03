import { Type, Transform } from 'class-transformer';
import { Allow, IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export const storySortOptions = ['latest', 'views', 'rating', 'title_asc', 'chapters_desc', 'gifts', 'favorites'] as const;
export type StorySortOption = (typeof storySortOptions)[number];

export const trendWindowOptions = ['all', 'today', 'yesterday', 'week', 'month'] as const;
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
  @IsIn(['ongoing', 'completed', 'all'])
  status?: 'ongoing' | 'completed' | 'all';

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

  @Allow()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isInteractive?: boolean;

  @Allow()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isRecommended?: boolean;

  @Allow()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  recommended?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minViews?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxViews?: number;

  @IsOptional()
  @Type(() => Number)
  rating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  chapters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minChapters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxChapters?: number;

  @IsOptional()
  @IsString()
  createdAt?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsIn(['views', 'chapters', 'chapters_count', 'totalChapters', 'createdAt', 'rating'])
  sortBy?: 'views' | 'chapters' | 'chapters_count' | 'totalChapters' | 'createdAt' | 'rating';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  lang?: string;
}
