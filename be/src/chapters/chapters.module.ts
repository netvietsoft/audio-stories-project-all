import { Module } from '@nestjs/common';

import { UserFeaturesModule } from '@/user-features/user-features.module';
import { ChaptersService } from './chapters.service';
import { ChaptersController } from './chapters.controller';
import { ChapterVariantsModule } from './chapter-variants/chapter-variants.module';

@Module({
    imports: [UserFeaturesModule, ChapterVariantsModule],
    controllers: [ChaptersController],
    providers: [ChaptersService],
    exports: [ChaptersService, ChapterVariantsModule],
})
export class ChaptersModule { }
