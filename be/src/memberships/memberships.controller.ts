import { Controller, Get, Query, Param, Delete, UseGuards } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { MembershipQueryDto } from './dto/membership-query.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@Controller('memberships')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN')
export class MembershipsController {
    constructor(private readonly membershipsService: MembershipsService) { }

    @Get()
    findAll(@Query() query: MembershipQueryDto) {
        return this.membershipsService.findAll(query);
    }

    @Get('stats')
    getStats() {
        return this.membershipsService.getStats();
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.membershipsService.remove(id);
    }
}
