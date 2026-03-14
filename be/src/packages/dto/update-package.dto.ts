import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class UpdatePackageDto {
    @IsString()
    @IsOptional()
    @MaxLength(100)
    name?: string;

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
    credits?: number;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    description?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsInt()
    @IsOptional()
    displayOrder?: number;
}
