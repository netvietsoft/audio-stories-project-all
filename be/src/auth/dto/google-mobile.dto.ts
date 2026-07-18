import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleMobileDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
