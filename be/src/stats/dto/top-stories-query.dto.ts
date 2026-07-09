import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TopStoryMetric } from '../stats.service';

export class TopStoriesQueryDto {
  @IsEnum(TopStoryMetric)
  metric: TopStoryMetric;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 100;

  @IsOptional() @IsString()
  language?: string;
}
