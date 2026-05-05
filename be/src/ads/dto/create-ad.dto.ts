import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export enum AdContentTypeDto {
  image = 'image',
  iframe = 'iframe',
}

export class CreateAdDto {
  @IsString()
  @MaxLength(120)
  partnerName: string;

  @IsString()
  @MaxLength(255)
  title: string;

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
