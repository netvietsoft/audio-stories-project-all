import { Type } from 'class-transformer';
import { ChapterAccessType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class ChapterQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    limit?: number = 20;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(ChapterAccessType)
    accessType?: ChapterAccessType;

    @IsOptional()
    @IsString()
    storyId?: string;

    @IsOptional()
    @IsString()
    lang?: string;
}
