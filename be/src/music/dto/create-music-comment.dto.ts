import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMusicCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
