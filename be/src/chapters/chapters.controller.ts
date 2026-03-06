import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
} from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@Controller()
export class ChaptersController {
    constructor(private readonly chaptersService: ChaptersService) { }

    @Get('stories/:storyId/chapters')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    findAll(@Param('storyId') storyId: string) {
        return this.chaptersService.findAllByStory(storyId);
    }

    @Post('stories/:storyId/chapters')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    create(
        @Param('storyId') storyId: string,
        @Body() createChapterDto: CreateChapterDto,
    ) {
        return this.chaptersService.create(storyId, createChapterDto);
    }

    @Get('chapters/:id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    findOne(@Param('id') id: string) {
        return this.chaptersService.findOne(id);
    }

    @Patch('chapters/:id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    update(@Param('id') id: string, @Body() updateChapterDto: UpdateChapterDto) {
        return this.chaptersService.update(id, updateChapterDto);
    }

    @Delete('chapters/:id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    remove(@Param('id') id: string) {
        return this.chaptersService.remove(id);
    }
}
