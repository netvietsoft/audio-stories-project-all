import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
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
    title?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000000)
    content?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    thumbnailUrl?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    r2AudioUrl?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    youtubeVideoId?: string;

    @IsNumber()
    @IsOptional()
    audioDuration?: number;

    @IsEnum(ChapterAccessType)
    @IsOptional()
    accessType?: ChapterAccessType;

    @IsOptional()
    @IsBoolean()
    isInteractive?: boolean;

    @IsString()
    @IsOptional()
    @MaxLength(10)
    language?: string;
}
