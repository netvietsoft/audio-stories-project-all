import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SettingType } from '@prisma/client';

export class CreateSettingDto {
    @IsString()
    @IsNotEmpty()
    key: string;

    @IsString()
    @IsOptional()
    value?: string;

    @IsEnum(SettingType)
    type: SettingType;

    @IsString()
    @IsOptional()
    description?: string;
}
