import { IsNotEmpty, IsUUID } from 'class-validator';

import { CreateChapterDto } from './create-chapter.dto';

export class CreateStandaloneChapterDto extends CreateChapterDto {
  @IsUUID()
  @IsNotEmpty()
  storyId: string;
}
