import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class UpdatePackageDto {
    @IsString()
    @IsOptional()
    @MaxLength(100)
    name?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    nameVi?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    nameEn?: string;

    @IsInt()
    @IsPositive()
    @IsOptional()
    priceVnd?: number;

    @IsInt()
    @IsPositive()
    @IsOptional()
    price?: number;

    @IsString()
    @IsOptional()
    @MaxLength(10)
    currency?: string;

    @IsString()
    @IsOptional()
    @MaxLength(10)
    lang?: string;

    @IsInt()
    @IsPositive()
    @IsOptional()
    pulseAmount?: number;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    description?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    descriptionVi?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    descriptionEn?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsBoolean()
    @IsOptional()
    isPopular?: boolean;

    @IsBoolean()
    @IsOptional()
    isBestValue?: boolean;

    @IsInt()
    @IsOptional()
    displayOrder?: number;
}
