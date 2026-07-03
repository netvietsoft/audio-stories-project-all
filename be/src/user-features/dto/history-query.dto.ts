import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsUUID()
  chapterId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  variantId?: string;
}
