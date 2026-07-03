import { IsString, IsOptional, IsInt, IsUUID, Min, MaxLength } from 'class-validator';

export class CreateChapterVariantDto {
    @IsUUID()
    chapterId: string;

    @IsOptional()
    @IsUUID()
    nextChapterId?: string | null;

    @IsOptional()
    @IsUUID()
    nextVariantId?: string | null;

    @IsOptional()
    @IsUUID()
    parentId?: string | null;

    @IsString()
    @MaxLength(300)
    title: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    audioUrl?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    r2AudioUrl?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    audioDuration?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    unlockPrice?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    orderIndex?: number;

    @IsOptional()
    isDefault?: boolean;
}
