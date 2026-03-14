import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@Controller('packages')
export class PackagesController {
    constructor(private readonly packagesService: PackagesService) { }

    @Get()
    findAll(@Query('lang') lang?: string) {
        return this.packagesService.findAll(lang);
    }

    @Post()
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    create(@Body() createPackageDto: CreatePackageDto) {
        return this.packagesService.create(createPackageDto);
    }

    @Patch(':code')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    update(@Param('code') code: string, @Body() updatePackageDto: UpdatePackageDto) {
        return this.packagesService.update(code, updatePackageDto);
    }

    @Delete(':code')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    remove(@Param('code') code: string) {
        return this.packagesService.remove(code);
    }
}
