import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChapterAccessType } from '@prisma/client';

export class CreateChapterDto {
    @IsNumber()
    @IsNotEmpty()
    chapterNumber: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(300)
    titleVi: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(300)
    titleEn: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    descriptionVi?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    descriptionEn?: string;

    @IsOptional()
    @IsString()
    contentVi?: string;

    @IsOptional()
    @IsString()
    contentEn?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    audioUrlVi?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    audioUrlEn?: string;

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
}
