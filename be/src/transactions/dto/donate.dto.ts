import { IsInt, IsNotEmpty, IsPositive, IsString, MaxLength } from 'class-validator';

export class DonateDto {
    @IsInt()
    @IsPositive()
    @IsNotEmpty()
    amount: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    description: string;
}
