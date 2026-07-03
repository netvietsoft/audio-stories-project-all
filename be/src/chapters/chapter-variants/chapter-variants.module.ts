import { Module } from '@nestjs/common';
import { HlsModule } from '@/hls/hls.module';
import { ChapterVariantsService } from './chapter-variants.service';
import { ChapterVariantsController } from './chapter-variants.controller';

@Module({
    imports: [HlsModule],
    controllers: [ChapterVariantsController],
    providers: [ChapterVariantsService],
    exports: [ChapterVariantsService],
})
export class ChapterVariantsModule { }
