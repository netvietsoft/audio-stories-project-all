import { Module } from '@nestjs/common';

import { UserFeaturesModule } from '@/user-features/user-features.module';
import { HlsModule } from '@/hls/hls.module';
import { GeoModule } from '@/common/geo/geo.module';
import { ChaptersService } from './chapters.service';
import { ChaptersController } from './chapters.controller';
import { ChapterVariantsModule } from './chapter-variants/chapter-variants.module';

@Module({
    imports: [UserFeaturesModule, ChapterVariantsModule, HlsModule, GeoModule],
    controllers: [ChaptersController],
    providers: [ChaptersService],
    exports: [ChaptersService, ChapterVariantsModule],
})
export class ChaptersModule { }
