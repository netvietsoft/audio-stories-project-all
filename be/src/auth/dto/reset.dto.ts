import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class ResetDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'Reset code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Reset code must contain only digits' })
  code!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
