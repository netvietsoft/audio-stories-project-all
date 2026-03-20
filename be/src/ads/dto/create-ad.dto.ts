import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
