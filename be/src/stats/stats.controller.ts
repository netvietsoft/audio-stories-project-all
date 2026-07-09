import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { StatsService } from './stats.service';
import { VipChapterStatsQueryDto } from './dto/vip-chapter-stats-query.dto';
import { TopStoriesQueryDto } from './dto/top-stories-query.dto';
import { TopCountriesQueryDto } from './dto/top-countries-query.dto';
import { StoriesByCountryQueryDto } from './dto/stories-by-country-query.dto';
import { StoryTopCountriesQueryDto } from './dto/story-top-countries-query.dto';

@ApiTags('Stats')
@Controller('stats')
export class StatsController {
    constructor(private readonly statsService: StatsService) { }

    @ApiOperation({ summary: 'Lấy thống kê tổng quan (admin)' })
    @Get('overview')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async getOverviewStats() {
        return this.statsService.getOverviewStats();
    }

    @ApiOperation({ summary: 'Lấy thống kê chương VIP (admin)' })
    @Get('vip-chapters')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async getVipChapterStats(@Query() query: VipChapterStatsQueryDto) {
        return this.statsService.getVipChapterStats(query);
    }

    @ApiOperation({ summary: 'Top truyện theo metric (admin)' })
    @Get('top-stories')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async getTopStories(@Query() query: TopStoriesQueryDto) {
        return this.statsService.getTopStories(query);
    }

    @ApiOperation({ summary: 'Top quốc gia theo metric (admin)' })
    @Get('top-countries')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async getTopCountries(@Query() query: TopCountriesQueryDto) {
        return this.statsService.getTopCountries(query);
    }

    @ApiOperation({ summary: 'Top truyện theo quốc gia (admin)' })
    @Get('top-stories-by-country')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async getTopStoriesByCountry(@Query() query: StoriesByCountryQueryDto) {
        return this.statsService.getTopStoriesByCountry(query);
    }

    @ApiOperation({ summary: 'Top quốc gia của một truyện (admin)' })
    @Get('story-top-countries')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async getStoryTopCountries(@Query() query: StoryTopCountriesQueryDto) {
        return this.statsService.getStoryTopCountries(query);
    }
}
