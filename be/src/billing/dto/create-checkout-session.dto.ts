import { IsString, IsOptional, IsEnum } from 'class-validator';
import { PaymentProvider } from '../enums';

export class CreateCheckoutSessionDto {
  @IsString()
  package_code: string;

  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider = PaymentProvider.STRIPE;

  @IsString()
  @IsOptional()
  success_url?: string;

  @IsString()
  @IsOptional()
  cancel_url?: string;
}
