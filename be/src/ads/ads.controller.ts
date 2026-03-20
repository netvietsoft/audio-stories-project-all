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
  findAllAdmin() {
    return this.adsService.findAllAdmin();
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
