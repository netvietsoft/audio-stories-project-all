import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { StoryStatus } from '@prisma/client';

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
    @IsArray()

    @IsInt({ each: true })
    categoryIds?: number[];
}
