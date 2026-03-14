import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class PackagesService {
    constructor(private readonly prisma: PrismaService) { }

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
            // Return all packages - frontend will handle locale-specific display
            // Each package now has nameVi, nameEn, descriptionVi, descriptionEn
            return allPackages;
        } catch {
            return [];
        }
    }

    async create(createPackageDto: CreatePackageDto) {
        const packages = await this.findAll();

        // Check if code already exists
        if (packages.find((p: any) => p.code === createPackageDto.code)) {
            throw new ConflictException(`Package with code "${createPackageDto.code}" already exists`);
        }

        const newPackage = {
            ...createPackageDto,
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
                description: 'Danh sách các gói thanh toán',
            },
        });

        return newPackage;
    }

    async update(code: string, updatePackageDto: UpdatePackageDto) {
        const packages = await this.findAll();
        const index = packages.findIndex((p: any) => p.code === code);

        if (index === -1) {
            throw new NotFoundException(`Package with code "${code}" not found`);
        }

        packages[index] = {
            ...packages[index],
            ...updatePackageDto,
            updatedAt: new Date().toISOString(),
        };

        await this.prisma.siteSetting.update({
            where: { key: 'payment_packages' },
            data: { value: JSON.stringify(packages) },
        });

        return packages[index];
    }

    async remove(code: string) {
        const packages = await this.findAll();
        const index = packages.findIndex((p: any) => p.code === code);

        if (index === -1) {
            throw new NotFoundException(`Package with code "${code}" not found`);
        }

        const removed = packages.splice(index, 1)[0];

        await this.prisma.siteSetting.update({
            where: { key: 'payment_packages' },
            data: { value: JSON.stringify(packages) },
        });

        return removed;
    }
}
