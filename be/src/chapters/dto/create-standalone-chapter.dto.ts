import { IsOptional, IsUUID } from 'class-validator';

import { CreateChapterDto } from './create-chapter.dto';

export class CreateStandaloneChapterDto extends CreateChapterDto {
  @IsUUID()
  @IsOptional()
  storyId?: string;
}
