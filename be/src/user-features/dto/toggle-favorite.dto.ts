import { IsString, IsUUID } from 'class-validator';

export class ToggleFavoriteDto {
  @IsString()
  @IsUUID()
  storyId: string;
}
