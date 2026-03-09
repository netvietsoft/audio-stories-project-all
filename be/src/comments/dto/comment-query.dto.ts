import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CommentQueryDto {
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
    @Type(() => Boolean)
    @IsBoolean()
    isHidden?: boolean;

    @IsOptional()
    @IsString()
    storyId?: string;

    @IsOptional()
    @IsString()
    chapterId?: string;
}
