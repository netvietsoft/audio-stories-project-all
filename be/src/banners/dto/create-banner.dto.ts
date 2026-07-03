import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateBannerDto {
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
  imageUrl: string;

  @IsString()
  @MaxLength(500)
  targetUrl: string;

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
