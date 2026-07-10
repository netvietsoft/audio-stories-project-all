import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { StatsService } from './stats.service';
import { VipChapterStatsQueryDto } from './dto/vip-chapter-stats-query.dto';
import { TopStoriesQueryDto } from './dto/top-stories-query.dto';

@Controller('stats')
export class StatsController {
    constructor(private readonly statsService: StatsService) { }

    @Get('overview')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async getOverviewStats() {
        return this.statsService.getOverviewStats();
    }

    @Get('vip-chapters')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async getVipChapterStats(@Query() query: VipChapterStatsQueryDto) {
        return this.statsService.getVipChapterStats(query);
    }

    @Get('top-stories')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async getTopStories(@Query() query: TopStoriesQueryDto) {
        return this.statsService.getTopStories(query);
    }
}
