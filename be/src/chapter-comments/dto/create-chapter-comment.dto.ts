import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export enum ChapterCommentScope {
  CHAPTER = 'chapter',
  PARAGRAPH = 'paragraph',
}

export class CreateChapterCommentDto {
  @IsString()
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsEnum(ChapterCommentScope)
  scope?: ChapterCommentScope;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paragraphIndex?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paragraphAnchor?: string;
}
