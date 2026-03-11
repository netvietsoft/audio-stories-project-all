import { IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChapterAccessType } from '@prisma/client';

export class UpdateChapterDto {
    @IsNumber()
    @IsOptional()
    chapterNumber?: number;

    @IsString()
    @IsOptional()
    @MaxLength(300)
    title?: string;

    @IsString()
    @IsOptional()
    @MaxLength(2000)
    description?: string;

    @IsString()
    @IsOptional()
    content?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    r2AudioUrl?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    thumbnailUrl?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    audioUrl?: string;

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
}
