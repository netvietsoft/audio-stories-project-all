import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { StatsService } from './stats.service';
import { VipChapterStatsQueryDto } from './dto/vip-chapter-stats-query.dto';

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
}
