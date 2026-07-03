import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class SyncHistoryDto {
  @IsString()
  @IsUUID()
  storyId: string;

  @IsString()
  @IsUUID()
  chapterId: string;

  @IsInt()
  @Min(0)
  progressSeconds: number;

  @IsOptional()
  @IsString()
  @IsUUID()
  variantId?: string;
}
