import { IsString } from 'class-validator';

export class CreateVietQROrderDto {
  @IsString()
  package_code: string;
}
