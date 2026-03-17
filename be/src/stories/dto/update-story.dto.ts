import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';
import { StoryStatus } from '@prisma/client';

export class UpdateStoryDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsOptional()
  @IsEnum(StoryStatus)
  status?: StoryStatus;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'facebookGroupUrl must be a valid URL' })
  facebookGroupUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'twitterUrl must be a valid URL' })
  twitterUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'instagramUrl must be a valid URL' })
  instagramUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'redditUrl must be a valid URL' })
  redditUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'whatsappUrl must be a valid URL' })
  whatsappUrl?: string;

  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];
}
