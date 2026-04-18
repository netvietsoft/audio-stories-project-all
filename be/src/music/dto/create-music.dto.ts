import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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

const toPlaylistTrackAccessArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;

  let parsed: unknown = value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }

  if (!Array.isArray(parsed)) return undefined;

  return parsed
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row = item as Record<string, unknown>;
      const rawTrackId = row.trackId;
      const rawAccessType = row.accessType;
      const rawUnlockPrice = row.unlockPrice;

      const trackId = typeof rawTrackId === 'string' ? rawTrackId.trim() : '';
      const accessType = typeof rawAccessType === 'string' ? rawAccessType.trim().toLowerCase() : undefined;

      let unlockPrice: number | undefined;
      if (typeof rawUnlockPrice === 'number') {
        unlockPrice = rawUnlockPrice;
      } else if (typeof rawUnlockPrice === 'string' && rawUnlockPrice.trim()) {
        const parsedPrice = Number(rawUnlockPrice);
        if (Number.isFinite(parsedPrice)) {
          unlockPrice = parsedPrice;
        }
      }

      return {
        trackId,
        accessType,
        unlockPrice,
      };
    })
    .filter((item) => Boolean(item.trackId));
};

export class CreateMusicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(350)
  slug?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  artist!: string;

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
  @Transform(toPlaylistTrackAccessArray)
  @IsArray()
  playlistTrackAccess?: Array<{
    trackId: string;
    accessType?: string;
    unlockPrice?: number;
  }>;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isPublic?: boolean;
}
