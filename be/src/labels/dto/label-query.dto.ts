import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class LabelQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  limit?: number = 50;

  @IsOptional() @IsString()
  search?: string;
}
