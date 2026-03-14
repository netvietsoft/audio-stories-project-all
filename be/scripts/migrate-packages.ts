import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating payment packages to new structure...');

  // Get current packages
  const setting = await prisma.siteSetting.findUnique({
    where: { key: 'payment_packages' },
  });

  if (!setting || !setting.value) {
    console.log('No existing packages found. Run seed-packages.ts instead.');
    return;
  }

  const oldPackages = JSON.parse(setting.value);
  console.log(`Found ${oldPackages.length} existing packages`);

  // Backup old data
  const backupKey = `payment_packages_backup_${Date.now()}`;
  await prisma.siteSetting.create({
    data: {
      key: backupKey,
      value: setting.value,
      type: 'json',
      description: `Backup of payment_packages before migration at ${new Date().toISOString()}`,
    },
  });
  console.log(`✅ Backup created with key: ${backupKey}`);

  // Migrate to new structure
  const newPackages = oldPackages.map((pkg: any) => ({
    code: pkg.code,
    nameVi: pkg.nameVi || pkg.name || 'Gói thanh toán',
    nameEn: pkg.nameEn || pkg.name || 'Payment Package',
    priceVnd: pkg.priceVnd,
    credits: pkg.credits,
    descriptionVi: pkg.descriptionVi || pkg.description || '',
    descriptionEn: pkg.descriptionEn || pkg.description || '',
    isActive: pkg.isActive ?? true,
    isPopular: pkg.isPopular ?? false,
    isBestValue: pkg.isBestValue ?? false,
    displayOrder: pkg.displayOrder ?? 0,
  }));

  // Update in database
  await prisma.siteSetting.update({
    where: { key: 'payment_packages' },
    data: {
      value: JSON.stringify(newPackages),
    },
  });

  console.log('✅ Migration completed successfully!');
  console.log('\nUpdated packages:');
  newPackages.forEach((pkg: any) => {
    console.log(`  - ${pkg.nameVi} / ${pkg.nameEn}`);
    console.log(`    Price: ${pkg.priceVnd.toLocaleString('vi-VN')}đ = ${pkg.credits} credits`);
    console.log(`    Popular: ${pkg.isPopular}, Best Value: ${pkg.isBestValue}`);
  });
  console.log(`\n💾 Backup saved as: ${backupKey}`);
  console.log('   You can restore from this backup if needed.');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
