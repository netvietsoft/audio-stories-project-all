import { Type } from 'class-transformer';
import { CommentReportStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListCommentReportsDto {
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
  @IsEnum(CommentReportStatus)
  status?: CommentReportStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

