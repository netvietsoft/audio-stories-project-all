import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class SetUserPulseDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pulseBalance: number;
}
