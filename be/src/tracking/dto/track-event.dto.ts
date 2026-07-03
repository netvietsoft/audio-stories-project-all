import { IsString, IsUUID, Length } from 'class-validator';

export class TrackEventDto {
  @IsString()
  @IsUUID()
  storyId: string;

  @IsString()
  @IsUUID()
  chapterId: string;

  @IsString()
  @Length(8, 128)
  deviceId: string;
}
