import { IsBoolean } from 'class-validator';

export class UpdateRecommendedDto {
  @IsBoolean()
  isRecommended: boolean;
}
