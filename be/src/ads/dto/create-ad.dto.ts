import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAdDto {
  @IsString()
  @MaxLength(120)
  partnerName: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  imageUrl: string;

  @IsString()
  @MaxLength(500)
  targetUrl: string;

  @IsOptional()
  @IsNumber()
  languageId?: number | null;

  @IsBoolean()
  @IsOptional()
  isGlobal?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
