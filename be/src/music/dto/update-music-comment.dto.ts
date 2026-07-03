import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateMusicCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}
