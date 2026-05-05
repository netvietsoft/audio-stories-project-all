import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdDto {
  @IsString()
  @MaxLength(120)
  @IsOptional()
  partnerName?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  targetUrl?: string;

  @IsOptional()
  @IsNumber()
  languageId?: number | null;

  @IsBoolean()
  @IsOptional()
  isGlobal?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  routeType?: number;
}
