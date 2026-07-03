import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { BannersService } from './banners.service';
import { BannerQueryDto } from './dto/banner-query.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@ApiTags('Banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @ApiOperation({ summary: 'Lấy danh sách banner công khai' })
  @Get()
  findPublic(@Query() query: BannerQueryDto) {
    return this.bannersService.findPublic(query);
  }

  @ApiOperation({ summary: 'Lấy toàn bộ banner (admin)' })
  @Get('admin')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findAllAdmin() {
    return this.bannersService.findAllAdmin();
  }

  @ApiOperation({ summary: 'Lấy chi tiết banner theo id (admin)' })
  @Get('admin/:id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findOneAdmin(@Param('id') id: string) {
    return this.bannersService.findOneAdmin(id);
  }

  @ApiOperation({ summary: 'Tạo banner mới (admin)' })
  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  @ApiOperation({ summary: 'Cập nhật banner theo id (admin)' })
  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Xóa banner theo id (admin)' })
  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
