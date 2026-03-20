import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class UpdateBannerDto {
  @IsString()
  @MaxLength(255)
  @IsOptional()
  titleVi?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  titleEn?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  subtitleVi?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  subtitleEn?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  targetUrl?: string;

  @IsUUID()
  @IsOptional()
  storyId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
