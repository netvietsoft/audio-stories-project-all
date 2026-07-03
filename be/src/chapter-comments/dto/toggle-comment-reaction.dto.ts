import { IsEnum } from 'class-validator';
import { CommentReactionType } from '@prisma/client';

export class ToggleCommentReactionDto {
  @IsEnum(CommentReactionType)
  type: CommentReactionType;
}
