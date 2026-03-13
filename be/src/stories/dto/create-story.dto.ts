import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StoryStatus } from '@prisma/client';
import { CreateChapterDto } from '@/chapters/dto/create-chapter.dto';

export class CreateStoryDto {
    @IsString()
    @IsNotEmpty()
    titleVi: string;

    @IsString()
    @IsNotEmpty()
    titleEn: string;

    @IsString()
    @IsNotEmpty()
    slug: string;

    @IsString()
    @IsNotEmpty()
    descriptionVi: string;

    @IsString()
    @IsNotEmpty()
    descriptionEn: string;

    @IsOptional()
    @IsString()
    thumbnailUrl?: string;

    @IsUUID()
    @IsNotEmpty()
    authorId: string;

    @IsEnum(StoryStatus)
    @IsOptional()
    status?: StoryStatus;

    @IsOptional()
    @IsString()
    audioUrl?: string;

    @IsOptional()
    @IsUrl({}, { message: 'facebookGroupUrl must be a valid URL' })
    facebookGroupUrl?: string;

    @IsOptional()
    @IsBoolean()
    isRecommended?: boolean;

    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    categoryIds?: number[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateChapterDto)
    chapters?: CreateChapterDto[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    chapterIds?: string[];
}
