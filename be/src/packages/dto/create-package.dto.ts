import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreatePackageDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    code: string;

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
    @Min(0)
    priceVnd: number;

    @IsInt()
    @Min(0)
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
    @Min(0)
    pulseAmount: number;

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
    @Min(0)
    displayOrder?: number;
}
