import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@ApiTags('Packages')
@Controller('packages')
export class PackagesController {
    constructor(private readonly packagesService: PackagesService) { }

    @ApiOperation({ summary: 'Lấy danh sách gói nạp' })
    @Get()
    findAll(@Query('lang') lang?: string) {
        return this.packagesService.findAll(lang);
    }

    @ApiOperation({ summary: 'Tạo gói nạp mới (admin)' })
    @Post()
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    create(@Body() createPackageDto: CreatePackageDto) {
        return this.packagesService.create(createPackageDto);
    }

    @ApiOperation({ summary: 'Cập nhật gói nạp theo code (admin)' })
    @Patch(':code')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    update(@Param('code') code: string, @Body() updatePackageDto: UpdatePackageDto) {
        return this.packagesService.update(code, updatePackageDto);
    }

    @ApiOperation({ summary: 'Xóa gói nạp theo code (admin)' })
    @Delete(':code')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    remove(@Param('code') code: string) {
        return this.packagesService.remove(code);
    }
}
