import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StoryStatus } from '@prisma/client';
import { CreateChapterDto } from '@/chapters/dto/create-chapter.dto';

export class CreateStoryDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    slug: string;

    @IsOptional()
    @IsString()
    description?: string;

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
    @IsUrl({}, { message: 'twitterUrl must be a valid URL' })
    twitterUrl?: string;

    @IsOptional()
    @IsUrl({}, { message: 'instagramUrl must be a valid URL' })
    instagramUrl?: string;

    @IsOptional()
    @IsUrl({}, { message: 'redditUrl must be a valid URL' })
    redditUrl?: string;

    @IsOptional()
    @IsUrl({}, { message: 'whatsappUrl must be a valid URL' })
    whatsappUrl?: string;

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
