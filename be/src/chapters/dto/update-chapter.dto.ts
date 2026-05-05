import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ChapterAccessType } from '@prisma/client';

export class UpdateChapterDto {
    @IsString()
    @IsOptional()
    storyId?: string;

    @IsNumber()
    @IsOptional()
    chapterNumber?: number;

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
    @IsBoolean()
    isInteractive?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(10)
    language?: string;

    @IsOptional()
    @IsString()
    @MaxLength(36)
    unlockAdId?: string | null;
}
