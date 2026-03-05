import { IsString, MinLength } from 'class-validator';

export class ResetDto {
  @IsString()
  @MinLength(16)
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
