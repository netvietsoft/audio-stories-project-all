import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateLabelDto {
  @IsOptional() @IsString() @MaxLength(60)
  name?: string;

  @IsOptional() @IsString() @MaxLength(40)
  text?: string;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional() @IsString()
  textColor?: string;

  @IsOptional() @IsString() @MaxLength(60)
  icon?: string;

  @IsOptional() @IsInt() @Min(0)
  defaultDurationDays?: number;
}
