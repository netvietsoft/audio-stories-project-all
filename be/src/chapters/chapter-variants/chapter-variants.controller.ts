import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query,
} from '@nestjs/common';
import { ChapterVariantsService } from './chapter-variants.service';
import { CreateChapterVariantDto } from '../dto/create-chapter-variant.dto';
import { UpdateChapterVariantDto } from '../dto/update-chapter-variant.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Account } from '@/auth/decorators/account.decorator';

@Controller()
export class ChapterVariantsController {
    constructor(private readonly chapterVariantsService: ChapterVariantsService) { }

    @Get('chapters/:chapterId/variants')
    @UseGuards(JwtAccessGuard)
    findAllByChapter(
        @Param('chapterId') chapterId: string,
        @Query('parentId') parentId?: string
    ) {
        return this.chapterVariantsService.findAllByChapter(
            chapterId, 
            parentId === 'null' ? null : (parentId || undefined)
        );
    }

    @Get('chapter-variants/:id')
    @UseGuards(JwtAccessGuard)
    findOne(@Param('id') id: string) {
        return this.chapterVariantsService.findOne(id);
    }

    @Post('chapter-variants')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    create(@Body() createDto: CreateChapterVariantDto) {
        return this.chapterVariantsService.create(createDto);
    }

    @Patch('chapter-variants/:id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    update(@Param('id') id: string, @Body() updateDto: UpdateChapterVariantDto) {
        return this.chapterVariantsService.update(id, updateDto);
    }

    @Delete('chapter-variants/:id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    remove(@Param('id') id: string) {
        return this.chapterVariantsService.remove(id);
    }

    @Post('chapter-variants/:id/unlock')
    @UseGuards(JwtAccessGuard)
    unlock(@Param('id') id: string, @Account() user: any) {
        return this.chapterVariantsService.unlockVariant(user.id, id);
    }

    @Get('chapters/:chapterId/unlocked-variants')
    @UseGuards(JwtAccessGuard)
    getUnlocked(@Param('chapterId') chapterId: string, @Account() user: any) {
        return this.chapterVariantsService.getUnlockedVariants(user.id, chapterId);
    }
}
