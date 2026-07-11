import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
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
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  allParagraphs?: boolean;

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
