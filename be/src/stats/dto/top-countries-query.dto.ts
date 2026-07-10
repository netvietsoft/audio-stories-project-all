import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class TopCountriesQueryDto {
  @IsIn(['view', 'search', 'favorite', 'comment', 'rating', 'gift', 'revenue', 'listen', 'trending'])
  metric: 'view' | 'search' | 'favorite' | 'comment' | 'rating' | 'gift' | 'revenue' | 'listen' | 'trending';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 20;
}
