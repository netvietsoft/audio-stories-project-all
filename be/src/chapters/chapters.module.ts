import { Module } from '@nestjs/common';

import { UserFeaturesModule } from '@/user-features/user-features.module';
import { ChaptersService } from './chapters.service';
import { ChaptersController } from './chapters.controller';

@Module({
    imports: [UserFeaturesModule],
    controllers: [ChaptersController],
    providers: [ChaptersService],
})
export class ChaptersModule { }
