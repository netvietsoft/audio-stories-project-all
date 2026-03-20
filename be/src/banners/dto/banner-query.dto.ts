import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class BannerQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  lang?: string;
}
