import { IsEmail, IsOptional, IsUrl } from 'class-validator';

export class ForgotDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  redirect_uri?: string;
}
