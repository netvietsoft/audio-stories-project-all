import { IsEnum, IsString, IsUrl, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { SocialPlatform } from '@prisma/client';

export class CreateSocialLinkDto {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @IsString()
  label: string;

  @IsUrl()
  url: string;

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
