import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migratePackages() {
  try {
    console.log('Migrating packages from nameVi/nameEn to single name field...');

    const packagesSetting = await prisma.siteSetting.findUnique({
      where: { key: 'payment_packages' },
    });

    if (!packagesSetting || !packagesSetting.value) {
      console.log('❌ No payment_packages setting found');
      return;
    }

    let packages;
    try {
      packages = JSON.parse(packagesSetting.value);
    } catch (error) {
      console.error('❌ Failed to parse packages JSON:', error);
      return;
    }

    console.log('Current packages:', JSON.stringify(packages, null, 2));

    // Migrate packages: use nameVi or nameEn as name, remove nameVi/nameEn
    const migratedPackages = packages.map((pkg: any) => {
      const name = pkg.nameVi || pkg.nameEn || `${pkg.credits} Credits Package`;
      const description = pkg.descriptionVi || pkg.descriptionEn || '';
      
      // Create new package object without nameVi/nameEn/descriptionVi/descriptionEn
      const { nameVi, nameEn, descriptionVi, descriptionEn, ...rest } = pkg;
      
      return {
        ...rest,
        name,
        description,
      };
    });

    console.log('\nMigrated packages:', JSON.stringify(migratedPackages, null, 2));

    // Update database
    await prisma.siteSetting.update({
      where: { key: 'payment_packages' },
      data: {
        value: JSON.stringify(migratedPackages),
      },
    });

    console.log('\n✅ Successfully migrated packages to single name field');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migratePackages();
