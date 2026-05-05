import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdContentTypeDto } from './create-ad.dto';

export class UpdateAdDto {
  @IsString()
  @MaxLength(120)
  @IsOptional()
  partnerName?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  title?: string;

  @IsOptional()
  @IsEnum(AdContentTypeDto)
  contentType?: AdContentTypeDto;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  targetUrl?: string;

  @IsString()
  @IsOptional()
  iframeCode?: string;

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
