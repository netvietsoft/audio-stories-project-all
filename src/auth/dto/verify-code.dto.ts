import { IsEmail, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

export class VerifyCodeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Verification code must contain only digits' })
  code!: string;
}

export class ResendCodeDto {
  @IsEmail()
  email!: string;
}

export class ResendVerifyDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  redirect_uri?: string;
}
