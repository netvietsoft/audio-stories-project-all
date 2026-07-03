import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePersonalPlaylistDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;
}
