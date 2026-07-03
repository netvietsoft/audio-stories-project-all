import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SettingType } from '@prisma/client';

export class UpdateSettingDto {
    @IsString()
    @IsOptional()
    value?: string;

    @IsEnum(SettingType)
    @IsOptional()
    type?: SettingType;

    @IsString()
    @IsOptional()
    description?: string;
}
