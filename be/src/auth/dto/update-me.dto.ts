import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatar_url?: string | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  allow_email_noti?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  allow_bell_noti?: boolean;
}
