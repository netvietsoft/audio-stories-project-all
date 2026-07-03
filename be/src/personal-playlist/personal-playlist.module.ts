import { Module } from '@nestjs/common';

import { PersonalPlaylistController } from './personal-playlist.controller';
import { PersonalPlaylistService } from './personal-playlist.service';

@Module({
  controllers: [PersonalPlaylistController],
  providers: [PersonalPlaylistService],
  exports: [PersonalPlaylistService],
})
export class PersonalPlaylistModule {}
