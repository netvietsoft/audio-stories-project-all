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
    Req,
    Res,
    HttpCode,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChaptersService } from './chapters.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { CreateStandaloneChapterDto } from './dto/create-standalone-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ChapterQueryDto } from './dto/chapter-query.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { OptionalJwtGuard } from '@/auth/guards/optional-jwt.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { clientIp } from '@/common/geo/geo.util';

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

    @Post('chapters')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    createStandalone(@Body() createChapterDto: CreateStandaloneChapterDto) {
        return this.chaptersService.createStandalone(createChapterDto);
    }

    @Public()
    @Get('chapters/latest')
    getLatest(
        @Query('limit') limit?: string,
        @Query('lang') lang?: string,
    ) {
        const safeLimit = Math.min(Number(limit) || 12, 50); // Clamp max to 50
        return this.chaptersService.findLatest(safeLimit, lang);
    }

    @Get('chapters')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    findAllGlobal(@Query() query: ChapterQueryDto) {
        return this.chaptersService.findAllGlobal(query);
    }

    @Public()
    @Get('chapters/:id/public')
    findPublicDetail(@Param('id') id: string) {
        return this.chaptersService.findPublicDetail(id);
    }

    @UseGuards(OptionalJwtGuard)
    @Get('chapters/:id/unlock-status')
    getUnlockStatus(@Param('id') id: string, @Req() req: Request) {
        const userId = (req.user as any)?.id;
        return this.chaptersService.getUnlockStatus(id, userId);
    }

    /**
     * Audio proxy endpoint — resolves the CDN/R2 URL after entitlement check.
     *
     * - Free chapters: accessible to everyone (anonymous or logged-in)
     * - VIP/timed chapters: requires valid VIP membership
     * - Unlockable chapters: requires UserUnlockedVariant record or VIP
     *
     * Returns HTTP 302 redirect to the real audio URL.
     * The client (audio player) follows the redirect transparently.
     */
    @UseGuards(OptionalJwtGuard)
    @Get('chapters/:id/audio')
    @HttpCode(302)
    async getAudio(
        @Param('id') id: string,
        @Query('variantId') variantId: string | undefined,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const userId = (req.user as any)?.id;
        const { url } = await this.chaptersService.getAudioUrl(id, userId, variantId);
        // 302 redirect — audio player follows automatically, no buffering in NestJS
        return res.redirect(302, url);
    }

        @UseGuards(OptionalJwtGuard)
        @Post('chapters/:id/unlock-by-ad')
        async unlockByAd(
            @Param('id') id: string,
            @Body('adId') adId: string | undefined,
            @Req() req: Request,
        ) {
            const userId = (req.user as any)?.id;
            return this.chaptersService.unlockByAd(id, adId, userId);
        }

    @UseGuards(JwtAccessGuard)
    @Post('chapters/:id/unlock-by-pulse')
    unlockByPulse(@Param('id') id: string, @Req() req: Request) {
        const userId = (req.user as any)?.id;
        return this.chaptersService.unlockByPulse(id, userId, clientIp(req));
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
