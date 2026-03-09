import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@Controller('settings')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get()
    findAll() {
        return this.settingsService.findAll();
    }

    @Post()
    create(@Body() createSettingDto: CreateSettingDto) {
        return this.settingsService.create(createSettingDto);
    }

    @Patch('bulk')
    updateMultiple(@Body() updateSettingsDto: UpdateSettingsDto) {
        return this.settingsService.updateMultiple(updateSettingsDto);
    }

    @Patch(':key')
    update(@Param('key') key: string, @Body() updateSettingDto: UpdateSettingDto) {
        return this.settingsService.update(key, updateSettingDto);
    }

    @Delete(':key')
    remove(@Param('key') key: string) {
        return this.settingsService.remove(key);
    }
}
