import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { BannersService } from './banners.service';
import { BannerQueryDto } from './dto/banner-query.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  findPublic(@Query() query: BannerQueryDto) {
    return this.bannersService.findPublic(query);
  }

  @Get('admin')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findAllAdmin() {
    return this.bannersService.findAllAdmin();
  }

  @Get('admin/:id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findOneAdmin(@Param('id') id: string) {
    return this.bannersService.findOneAdmin(id);
  }

  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
