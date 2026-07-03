import { Controller, Get, Query, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MembershipsService } from './memberships.service';
import { MembershipQueryDto } from './dto/membership-query.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@ApiTags('Memberships')
@Controller('memberships')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN')
export class MembershipsController {
    constructor(private readonly membershipsService: MembershipsService) { }

    @ApiOperation({ summary: 'Lấy danh sách thành viên (admin)' })
    @Get()
    findAll(@Query() query: MembershipQueryDto) {
        return this.membershipsService.findAll(query);
    }

    @ApiOperation({ summary: 'Lấy thống kê thành viên (admin)' })
    @Get('stats')
    getStats() {
        return this.membershipsService.getStats();
    }

    @ApiOperation({ summary: 'Xóa thành viên theo id (admin)' })
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.membershipsService.remove(id);
    }
}
