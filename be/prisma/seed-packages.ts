import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding payment packages...');

  const packages = [
    {
      code: 'BASIC',
      nameVi: 'Gói Cơ Bản',
      nameEn: 'Basic Package',
      priceVnd: 50000,
      credits: 50,
      descriptionVi: 'Gói cơ bản cho người dùng mới',
      descriptionEn: 'Basic package for new users',
      isActive: true,
      isPopular: false,
      isBestValue: false,
      displayOrder: 1,
    },
    {
      code: 'STANDARD',
      nameVi: 'Gói Tiêu Chuẩn',
      nameEn: 'Standard Package',
      priceVnd: 100000,
      credits: 110,
      descriptionVi: 'Gói phổ biến nhất - Tặng thêm 10%',
      descriptionEn: 'Most popular package - Extra 10% bonus',
      isActive: true,
      isPopular: true,
      isBestValue: false,
      displayOrder: 2,
    },
    {
      code: 'PREMIUM',
      nameVi: 'Gói Cao Cấp',
      nameEn: 'Premium Package',
      priceVnd: 200000,
      credits: 230,
      descriptionVi: 'Gói cao cấp - Tặng thêm 15%',
      descriptionEn: 'Premium package - Extra 15% bonus',
      isActive: true,
      isPopular: false,
      isBestValue: true,
      displayOrder: 3,
    },
    {
      code: 'VIP',
      nameVi: 'Gói VIP',
      nameEn: 'VIP Package',
      priceVnd: 500000,
      credits: 600,
      descriptionVi: 'Gói VIP - Tặng thêm 20%',
      descriptionEn: 'VIP package - Extra 20% bonus',
      isActive: true,
      isPopular: false,
      isBestValue: false,
      displayOrder: 4,
    },
    {
      code: 'SUPER_VIP',
      nameVi: 'Gói Siêu VIP',
      nameEn: 'Super VIP Package',
      priceVnd: 1000000,
      credits: 1300,
      descriptionVi: 'Gói siêu VIP - Tặng thêm 30%',
      descriptionEn: 'Super VIP package - Extra 30% bonus',
      isActive: true,
      isPopular: false,
      isBestValue: false,
      displayOrder: 5,
    },
  ];

  await prisma.siteSetting.upsert({
    where: { key: 'payment_packages' },
    update: {
      value: JSON.stringify(packages),
      type: 'json',
      description: 'Danh sách các gói thanh toán',
    },
    create: {
      key: 'payment_packages',
      value: JSON.stringify(packages),
      type: 'json',
      description: 'Danh sách các gói thanh toán',
    },
  });

  console.log('Created payment packages:');
  packages.forEach((pkg) => {
    console.log(`  - ${pkg.nameVi} / ${pkg.nameEn}: ${pkg.priceVnd.toLocaleString('vi-VN')}đ = ${pkg.credits} credits`);
  });

  console.log('\nPackages seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
