import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export const storySortOptions = ['latest', 'views', 'title_asc', 'chapters_desc'] as const;
export type StorySortOption = (typeof storySortOptions)[number];

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
}
