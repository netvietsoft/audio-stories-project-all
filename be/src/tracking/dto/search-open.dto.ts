import { IsString, Length } from 'class-validator';

export class SearchOpenDto {
  @IsString()
  storyId: string; // slug OR uuid — resolved server-side

  @IsString()
  @Length(8, 128)
  deviceId: string;
}
