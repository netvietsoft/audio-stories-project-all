import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPackages() {
  try {
    console.log('Checking payment packages...');

    const packagesSetting = await prisma.siteSetting.findUnique({
      where: { key: 'payment_packages' },
    });

    if (!packagesSetting || !packagesSetting.value) {
      console.log('No payment_packages setting found. Creating default packages...');
      
      const defaultPackages = [
        {
          code: 'package_100',
          name: 'Gói 100 Credits',
          priceVnd: 20000,
          credits: 100,
          description: 'Gói cơ bản cho người dùng mới',
          isActive: true,
          displayOrder: 1,
        },
        {
          code: 'package_500',
          name: 'Gói 500 Credits',
          priceVnd: 90000,
          credits: 500,
          description: 'Gói phổ biến nhất',
          isActive: true,
          displayOrder: 2,
        },
        {
          code: 'package_1000',
          name: 'Gói 1000 Credits',
          priceVnd: 170000,
          credits: 1000,
          description: 'Gói tiết kiệm nhất',
          isActive: true,
          displayOrder: 3,
        },
      ];

      await prisma.siteSetting.create({
        data: {
          key: 'payment_packages',
          value: JSON.stringify(defaultPackages),
          type: 'json',
          description: 'Payment packages configuration',
        },
      });

      console.log('✅ Created default packages');
      return;
    }

    console.log('Current packages value:', packagesSetting.value);

    let packages;
    try {
      packages = JSON.parse(packagesSetting.value);
    } catch (error) {
      console.error('❌ Failed to parse packages JSON:', error);
      return;
    }

    console.log('Parsed packages:', JSON.stringify(packages, null, 2));

    // Check if packages have name field
    let needsUpdate = false;
    const updatedPackages = packages.map((pkg: any) => {
      if (!pkg.name) {
        console.log(`⚠️  Package ${pkg.code} is missing 'name' field`);
        needsUpdate = true;
        return {
          ...pkg,
          name: `Gói ${pkg.credits} Credits`,
        };
      }
      return pkg;
    });

    if (needsUpdate) {
      console.log('Updating packages with missing names...');
      await prisma.siteSetting.update({
        where: { key: 'payment_packages' },
        data: {
          value: JSON.stringify(updatedPackages),
        },
      });
      console.log('✅ Updated packages:', JSON.stringify(updatedPackages, null, 2));
    } else {
      console.log('✅ All packages have name field');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPackages();
