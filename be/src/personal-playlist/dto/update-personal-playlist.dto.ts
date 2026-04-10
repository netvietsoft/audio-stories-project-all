import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdatePersonalPlaylistDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
}