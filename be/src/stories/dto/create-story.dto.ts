import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
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
    @IsBoolean()
    isRecommended?: boolean;

    @IsOptional()
    @IsBoolean()
    isInteractive?: boolean;

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

    @IsOptional()
    @IsInt()
    labelId?: number | null;

    @IsOptional()
    @IsInt()
    @Min(0)
    labelDurationDaysOverride?: number;
}
