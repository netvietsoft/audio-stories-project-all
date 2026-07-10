import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ChapterAccessType } from '@prisma/client';

export class CreateChapterDto {
    @IsNumber()
    @IsNotEmpty()
    chapterNumber: number;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    @Transform(({ value }) => value === '' ? null : value)
    title?: string | null;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    @Transform(({ value }) => value === '' ? null : value)
    description?: string | null;

    @IsOptional()
    @IsString()
    @MaxLength(1000000)
    content?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    thumbnailUrl?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    r2AudioUrl?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    youtubeVideoId?: string;

    @IsNumber()
    @IsOptional()
    audioDuration?: number;

    @IsEnum(ChapterAccessType)
    @IsOptional()
    accessType?: ChapterAccessType;

    @IsOptional()
    @IsInt()
    @Min(0)
    unlockPrice?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    discountPercent?: number;

    @IsOptional()
    @IsBoolean()
    isInteractive?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(36)
    unlockAdId?: string | null;

    @IsOptional()
    @IsDateString()
    unlocksAt?: string;

    @IsOptional()
    @IsString()
    @MaxLength(10)
    language?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000000)
    timingRaw?: string;

    @IsOptional()
    @IsEnum(['srt', 'vtt', 'lrc', 'auto'] as any)
    timingFormat?: 'srt' | 'vtt' | 'lrc' | 'auto';
}
