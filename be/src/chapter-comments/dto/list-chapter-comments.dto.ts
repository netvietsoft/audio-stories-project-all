import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ChapterCommentScope } from './create-chapter-comment.dto';

export enum ChapterCommentSortType {
  NEWEST = 'newest',
  HELPFUL = 'helpful',
  ALL = 'all',
}

export class ListChapterCommentsDto {
  @IsOptional()
  @IsEnum(ChapterCommentScope)
  scope?: ChapterCommentScope;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paragraphIndex?: number;

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
  @IsEnum(ChapterCommentSortType)
  sort?: ChapterCommentSortType;
}
