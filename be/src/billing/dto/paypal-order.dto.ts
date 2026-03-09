import { IsString } from 'class-validator';

export class CreatePayPalOrderDto {
  @IsString()
  package_code: string;
}

export class CapturePayPalOrderDto {
  @IsString()
  order_id: string;
}
