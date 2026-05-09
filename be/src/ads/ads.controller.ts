import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { AdsService } from './ads.service';
import { ActiveAdsQueryDto } from './dto/active-ads-query.dto';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get('active')
  findActive(@Query() query: ActiveAdsQueryDto) {
    return this.adsService.findActive(query);
  }

  @Get()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findAllAdmin(
    @Query('title') title?: string,
    @Query('partnerName') partnerName?: string,
    @Query('language') language?: string,
    @Query('lang') lang?: string,
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('routeType') routeType?: string,
  ) {
    const parsedRouteType = routeType ? Number(routeType) : undefined;
    const normalizedActive = typeof isActive === 'string' ? isActive.trim().toLowerCase() : '';
    const parsedIsActive =
      normalizedActive === 'true' || normalizedActive === '1'
        ? true
        : normalizedActive === 'false' || normalizedActive === '0'
          ? false
          : undefined;

    return this.adsService.findAllAdmin({
      title,
      partnerName,
      language: language ?? lang,
      isActive: parsedIsActive,
      sortBy,
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
      routeType: Number.isFinite(parsedRouteType) ? parsedRouteType : undefined,
    });
  }

  @Get('partners')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findPartners(@Query('routeType') routeType?: string) {
    const parsedRouteType = routeType ? Number(routeType) : undefined;
    return this.adsService.findPartners(Number.isFinite(parsedRouteType) ? parsedRouteType : undefined);
  }

  @Get(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findOneAdmin(@Param('id') id: string) {
    return this.adsService.findOneAdmin(id);
  }

  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateAdDto) {
    return this.adsService.create(dto);
  }

  @Post(':id/click')
  incrementClick(@Param('id') id: string) {
    return this.adsService.incrementClick(id);
  }

  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateAdDto) {
    return this.adsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.adsService.remove(id);
  }
}
