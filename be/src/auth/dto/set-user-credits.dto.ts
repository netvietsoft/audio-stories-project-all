import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class SetUserCreditsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  credits: number;
}
