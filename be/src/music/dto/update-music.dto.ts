import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
};

const toStringArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return undefined;

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
};

export class UpdateMusicDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(350)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  artist?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  audioDuration?: number;

  @IsOptional()
  @IsString()
  @IsIn(['single', 'podcast', 'playlist'])
  contentType?: 'single' | 'podcast' | 'playlist';

  @IsOptional()
  @IsString()
  @IsIn(['free', 'vip'])
  accessType?: 'free' | 'vip';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unlockPrice?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  introEnabled?: boolean;

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  playlistTrackIds?: string[];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isPublic?: boolean;
}
