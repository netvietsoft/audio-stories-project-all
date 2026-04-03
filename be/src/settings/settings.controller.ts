import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get()
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    findAll() {
        return this.settingsService.findAll();
    }

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

    @Get(':key')
    @Public()
    findSystemConfigByKey(@Param('key') key: string) {
        return this.settingsService.getSystemConfigByKey(key);
    }

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

    @Post()
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    create(@Body() createSettingDto: CreateSettingDto) {
        return this.settingsService.create(createSettingDto);
    }

    @Patch('bulk')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    updateMultiple(@Body() updateSettingsDto: UpdateSettingsDto) {
        return this.settingsService.updateMultiple(updateSettingsDto);
    }

    @Patch(':key')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    updateSystemConfig(@Param('key') key: string, @Body() payload: UpdateSystemConfigDto) {
        return this.settingsService.updateSystemConfigByKey(key, payload.value);
    }

    @Patch('site/:key')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    updateSiteSetting(@Param('key') key: string, @Body() updateSettingDto: UpdateSettingDto) {
        return this.settingsService.update(key, updateSettingDto);
    }

    @Delete(':key')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    remove(@Param('key') key: string) {
        return this.settingsService.remove(key);
    }
}
