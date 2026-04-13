import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateMusicHistoryProgressDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  progressSeconds!: number;
}
