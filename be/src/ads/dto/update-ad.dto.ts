import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
