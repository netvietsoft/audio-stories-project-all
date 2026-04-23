import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PaymentPackage {
  code: string;
  name: string;
  priceVnd: number;
  pulseAmount: number;
  description?: string;
  isActive: boolean;
  displayOrder: number;
}

@Injectable()
export class PackagesHelperService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PaymentPackage[]> {
    const packagesSetting = await this.prisma.siteSetting.findUnique({
      where: { key: 'payment_packages' },
    });

    if (!packagesSetting || !packagesSetting.value) {
      return [];
    }

    try {
      return JSON.parse(packagesSetting.value);
    } catch {
      return [];
    }
  }

  async findByCode(code: string): Promise<PaymentPackage | null> {
    const packages = await this.findAll();
    return packages.find((p) => p.code === code) || null;
  }
}
