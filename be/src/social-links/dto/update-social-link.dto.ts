import { IsEnum, IsString, IsUrl, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { SocialPlatform } from '@prisma/client';

export class UpdateSocialLinkDto {
  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
