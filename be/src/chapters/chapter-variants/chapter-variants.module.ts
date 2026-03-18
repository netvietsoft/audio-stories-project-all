import { Module } from '@nestjs/common';
import { ChapterVariantsService } from './chapter-variants.service';
import { ChapterVariantsController } from './chapter-variants.controller';

@Module({
    controllers: [ChapterVariantsController],
    providers: [ChapterVariantsService],
    exports: [ChapterVariantsService],
})
export class ChapterVariantsModule { }
