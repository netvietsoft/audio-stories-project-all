import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding payment packages...');

  const packages = [
    {
      code: 'BASIC',
      name: 'Gói Cơ Bản',
      priceVnd: 50000,
      credits: 50,
      description: 'Gói cơ bản cho người dùng mới',
      isActive: true,
      displayOrder: 1,
    },
    {
      code: 'STANDARD',
      name: 'Gói Tiêu Chuẩn',
      priceVnd: 100000,
      credits: 110,
      description: 'Gói phổ biến nhất - Tặng thêm 10%',
      isActive: true,
      displayOrder: 2,
    },
    {
      code: 'PREMIUM',
      name: 'Gói Cao Cấp',
      priceVnd: 200000,
      credits: 230,
      description: 'Gói cao cấp - Tặng thêm 15%',
      isActive: true,
      displayOrder: 3,
    },
    {
      code: 'VIP',
      name: 'Gói VIP',
      priceVnd: 500000,
      credits: 600,
      description: 'Gói VIP - Tặng thêm 20%',
      isActive: true,
      displayOrder: 4,
    },
    {
      code: 'SUPER_VIP',
      name: 'Gói Siêu VIP',
      priceVnd: 1000000,
      credits: 1300,
      description: 'Gói siêu VIP - Tặng thêm 30%',
      isActive: true,
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
    console.log(`  - ${pkg.name}: ${pkg.priceVnd.toLocaleString('vi-VN')}đ = ${pkg.credits} credits`);
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
