import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReviewReplyDto {
  @IsString()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
