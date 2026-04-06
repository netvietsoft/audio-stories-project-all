import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { handlePrismaError } from '@/common/utils/error-handler.util';

@Injectable()
export class PackagesService {
    constructor(private readonly prisma: PrismaService) { }

    private hasLocaleContent(pkg: any, lang: string) {
        if (lang === 'vi') {
            return Boolean(
                (typeof pkg?.nameVi === 'string' && pkg.nameVi.trim()) ||
                (typeof pkg?.descriptionVi === 'string' && pkg.descriptionVi.trim()),
            );
        }

        if (lang === 'en') {
            return Boolean(
                (typeof pkg?.nameEn === 'string' && pkg.nameEn.trim()) ||
                (typeof pkg?.descriptionEn === 'string' && pkg.descriptionEn.trim()),
            );
        }

        return false;
    }
    async findAll(lang?: string) {
        // Using site_settings table to store packages as JSON
        const packagesSetting = await this.prisma.siteSetting.findUnique({
            where: { key: 'payment_packages' },
        });

        if (!packagesSetting || !packagesSetting.value) {
            return [];
        }

        try {
            const allPackages = JSON.parse(packagesSetting.value);

            if (!Array.isArray(allPackages)) {
                return [];
            }

            if (!lang) {
                return allPackages;
            }

            const normalizedLang = lang.toLowerCase();

            // Locale filter is flexible:
            // 1) Explicit package lang match.
            // 2) Package has localized content for requested locale (name/description).
            // This avoids empty lists for legacy data where lang is missing or inconsistent.
            const filtered = allPackages.filter((pkg: any) => {
                const pkgLang =
                    typeof pkg?.lang === 'string' && pkg.lang.trim().length > 0
                        ? pkg.lang.toLowerCase()
                        : '';
                return pkgLang === normalizedLang || this.hasLocaleContent(pkg, normalizedLang);
            });

            // Fall back to full list so UI does not break if data shape is unexpected.
            return filtered.length > 0 ? filtered : allPackages;
        } catch {
            return [];
        }
    }

    async create(createPackageDto: CreatePackageDto) {
        try {
            const packages = await this.findAll();

            // Check if code already exists
            if (packages.find((p: any) => p.code === createPackageDto.code)) {
                throw new ConflictException('Package with code "' + createPackageDto.code + '" already exists');
            }

            const newPackage = {
                ...createPackageDto,
                lang: (createPackageDto.lang || 'vi').toLowerCase(),
                isActive: createPackageDto.isActive ?? true,
                displayOrder: createPackageDto.displayOrder ?? packages.length,
                createdAt: new Date().toISOString(),
            };

            packages.push(newPackage);

            await this.prisma.siteSetting.upsert({
                where: { key: 'payment_packages' },
                update: { value: JSON.stringify(packages) },
                create: {
                    key: 'payment_packages',
                    value: JSON.stringify(packages),
                    type: 'json',
                    description: 'Danh sÃ¡ch cÃ¡c gÃ³i thanh toÃ¡n',
                },
            });

            return newPackage;
        } catch (error) {
            if (error instanceof ConflictException) {
                throw error;
            }
            handlePrismaError(error, 'Package');
        }
    }

    async update(code: string, updatePackageDto: UpdatePackageDto) {
        try {
            const packages = await this.findAll();
            const index = packages.findIndex((p: any) => p.code === code);

            if (index === -1) {
                throw new NotFoundException('Package with code "' + code + '" not found');
            }

            packages[index] = {
                ...packages[index],
                ...updatePackageDto,
                lang: updatePackageDto.lang
                    ? updatePackageDto.lang.toLowerCase()
                    : packages[index].lang,
                updatedAt: new Date().toISOString(),
            };

            await this.prisma.siteSetting.update({
                where: { key: 'payment_packages' },
                data: { value: JSON.stringify(packages) },
            });

            return packages[index];
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            handlePrismaError(error, 'Package');
        }
    }

    async remove(code: string) {
        const packages = await this.findAll();
        const index = packages.findIndex((p: any) => p.code === code);

        if (index === -1) {
            throw new NotFoundException('Package with code "' + code + '" not found');
        }

        const removed = packages.splice(index, 1)[0];

        await this.prisma.siteSetting.update({
            where: { key: 'payment_packages' },
            data: { value: JSON.stringify(packages) },
        });

        return removed;
    }
}

