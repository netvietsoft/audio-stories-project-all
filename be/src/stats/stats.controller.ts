import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
    constructor(private readonly statsService: StatsService) { }

    @Get('overview')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async getOverviewStats() {
        return this.statsService.getOverviewStats();
    }
}
