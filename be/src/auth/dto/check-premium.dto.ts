import { IsString, IsNotEmpty } from 'class-validator';

export class CheckPremiumDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;
}

export class CheckPremiumResponseDto {
  is_premium: boolean;
  premium_expires_at: Date | null;
}
