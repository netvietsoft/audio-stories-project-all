import { IsHexColor, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateLabelDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  name: string;

  @IsString() @IsNotEmpty() @MaxLength(40)
  text: string;

  @IsString() @IsNotEmpty() @IsHexColor()
  color: string;

  @IsOptional() @IsString() @IsHexColor()
  textColor?: string;

  @IsOptional() @IsString() @MaxLength(60)
  icon?: string;

  @IsOptional() @IsInt() @Min(0)
  defaultDurationDays?: number;
}
