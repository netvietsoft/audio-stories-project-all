import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StoryStatus } from '@prisma/client';
import { CreateChapterDto } from '@/chapters/dto/create-chapter.dto';

export class CreateStoryDto {
    @IsOptional()
    @IsString()
    titleVi?: string;

    @IsOptional()
    @IsString()
    titleEn?: string;

    @IsString()
    @IsNotEmpty()
    slug: string;

    @IsOptional()
    @IsString()
    descriptionVi?: string;

    @IsOptional()
    @IsString()
    descriptionEn?: string;

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

    @IsOptional()
    @IsString()
    language?: string;
}
