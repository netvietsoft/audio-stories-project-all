import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCommentDto {
    @IsOptional()
    @IsBoolean()
    isHidden?: boolean;
}
