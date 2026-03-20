import { IsInt, Min } from 'class-validator';

export class UpdateSystemConfigDto {
  @IsInt()
  @Min(1)
  value: number;
}
