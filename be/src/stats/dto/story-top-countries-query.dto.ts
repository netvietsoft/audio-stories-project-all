import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class StoryTopCountriesQueryDto {
  @IsString()
  storyId: string;

  @IsOptional() @IsIn(['view', 'search', 'favorite', 'comment', 'rating', 'gift', 'revenue', 'listen'])
  metric?: 'view' | 'search' | 'favorite' | 'comment' | 'rating' | 'gift' | 'revenue' | 'listen' = 'view';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 5;
}
