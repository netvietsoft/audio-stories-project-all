import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

const PUBLIC_KEYS = new Set<string>([
    'ad_insertion_frequency',
    'unlock_ad_reappearance_minutes',
    'unlock_ad_countdown_seconds',
]);

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @ApiOperation({ summary: 'Lấy toàn bộ cấu hình hệ thống (admin)' })
    @Get()
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    findAll() {
        return this.settingsService.findAll();
    }

    @ApiOperation({ summary: 'Lấy cấu hình site công khai' })
    @Get('site')
    @Public()
    async getSiteSettings() {
        const all = await this.settingsService.findAll();
        // keys we expose publicly
        const keys = ['facebook_url', 'twitter_url', 'instagram_url', 'youtube_url', 'reddit_url', 'whatsapp_url', 'custom_head_scripts'];
        const result: Record<string, any> = {};
        keys.forEach((k) => {
            result[k] = all[k]?.value ?? null;
        });
        return result;
    }

    @ApiOperation({ summary: 'Lấy cấu hình công khai theo key' })
    @Get(':key')
    @Public()
    findSystemConfigByKey(@Param('key') key: string) {
        if (!PUBLIC_KEYS.has(key)) {
            throw new NotFoundException(`Setting with key "${key}" not found`);
        }
        return this.settingsService.getSystemConfigByKey(key);
    }

    @ApiOperation({ summary: 'Cập nhật cấu hình site (admin)' })
    @Patch('site')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    async updateSiteSettings(@Body() payload: Record<string, any>) {
        // Map incoming friendly keys to stored keys
        const mapping: Record<string, string> = {
            facebookUrl: 'facebook_url',
            twitterUrl: 'twitter_url',
            instagramUrl: 'instagram_url',
            youtubeUrl: 'youtube_url',
            redditUrl: 'reddit_url',
            whatsappUrl: 'whatsapp_url',
        };
        const settings: Record<string, any> = {};
        Object.entries(payload).forEach(([k, v]) => {
            const mapped = mapping[k] ?? k;
            settings[mapped] = v;
        });

        return this.settingsService.updateMultiple({ settings });
    }

    @ApiOperation({ summary: 'Tạo cấu hình mới (admin)' })
    @Post()
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    create(@Body() createSettingDto: CreateSettingDto) {
        return this.settingsService.create(createSettingDto);
    }

    @ApiOperation({ summary: 'Cập nhật nhiều cấu hình cùng lúc (admin)' })
    @Patch('bulk')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    updateMultiple(@Body() updateSettingsDto: UpdateSettingsDto) {
        return this.settingsService.updateMultiple(updateSettingsDto);
    }

    @ApiOperation({ summary: 'Cập nhật cấu hình hệ thống theo key (admin)' })
    @Patch(':key')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    updateSystemConfig(@Param('key') key: string, @Body() payload: UpdateSystemConfigDto) {
        return this.settingsService.updateSystemConfigByKey(key, payload.value);
    }

    @ApiOperation({ summary: 'Cập nhật một cấu hình site theo key (admin)' })
    @Patch('site/:key')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    updateSiteSetting(@Param('key') key: string, @Body() updateSettingDto: UpdateSettingDto) {
        return this.settingsService.update(key, updateSettingDto);
    }

    @ApiOperation({ summary: 'Xóa cấu hình theo key (admin)' })
    @Delete(':key')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    remove(@Param('key') key: string) {
        return this.settingsService.remove(key);
    }
}
