import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        const settings = await this.prisma.siteSetting.findMany({
            orderBy: { key: 'asc' },
        });

        // Convert to key-value object
        const settingsObject: Record<string, any> = {};
        settings.forEach(setting => {
            let parsedValue: any = setting.value;
            
            // Parse value based on type
            if (setting.type === 'number' && setting.value) {
                parsedValue = parseFloat(setting.value);
            } else if (setting.type === 'boolean' && setting.value) {
                parsedValue = setting.value === 'true';
            } else if (setting.type === 'json' && setting.value) {
                try {
                    parsedValue = JSON.parse(setting.value);
                } catch (e) {
                    parsedValue = null;
                }
            }

            settingsObject[setting.key] = {
                value: parsedValue,
                type: setting.type,
                description: setting.description,
                updatedAt: setting.updatedAt,
            };
        });

        return settingsObject;
    }

    async create(createSettingDto: CreateSettingDto) {
        const { key, value, type, description } = createSettingDto;

        // Check if key already exists
        const existing = await this.prisma.siteSetting.findUnique({
            where: { key },
        });

        if (existing) {
            throw new ConflictException(`Setting with key "${key}" already exists`);
        }

        return this.prisma.siteSetting.create({
            data: {
                key,
                value,
                type,
                description,
            },
        });
    }

    async update(key: string, updateSettingDto: UpdateSettingDto) {
        const setting = await this.prisma.siteSetting.findUnique({
            where: { key },
        });

        if (!setting) {
            throw new NotFoundException(`Setting with key "${key}" not found`);
        }

        return this.prisma.siteSetting.update({
            where: { key },
            data: updateSettingDto,
        });
    }

    async updateMultiple(updateSettingsDto: UpdateSettingsDto) {
        const { settings } = updateSettingsDto;

        // Update each setting
        const updates = Object.entries(settings).map(([key, value]) => {
            let stringValue = value;

            // Convert value to string based on type
            if (typeof value === 'object') {
                stringValue = JSON.stringify(value);
            } else if (typeof value === 'boolean') {
                stringValue = value.toString();
            } else if (typeof value === 'number') {
                stringValue = value.toString();
            }

            return this.prisma.siteSetting.upsert({
                where: { key },
                update: { value: stringValue },
                create: {
                    key,
                    value: stringValue,
                    type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : typeof value === 'object' ? 'json' : 'string',
                },
            });
        });

        await Promise.all(updates);

        return { message: 'Settings updated successfully' };
    }

    async remove(key: string) {
        const setting = await this.prisma.siteSetting.findUnique({
            where: { key },
        });

        if (!setting) {
            throw new NotFoundException(`Setting with key "${key}" not found`);
        }

        return this.prisma.siteSetting.delete({
            where: { key },
        });
    }
}
