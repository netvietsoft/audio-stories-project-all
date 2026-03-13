import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    slug: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    nameEn?: string;

    @IsString()
    @IsOptional()
    nameVi?: string;

    @IsString()
    @IsOptional()
    iconUrl?: string;
}
