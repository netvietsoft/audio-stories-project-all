import { CommentReportStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCommentReportDto {
  @IsOptional()
  @IsEnum(CommentReportStatus)
  status?: CommentReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;

  @IsOptional()
  @IsBoolean()
  hideComment?: boolean;
}

