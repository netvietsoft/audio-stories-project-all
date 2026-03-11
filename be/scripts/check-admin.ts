import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking admin user...\n');

  const adminEmail = 'admin@truyen-audio.app';
  
  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { role: true },
  });

  if (!user) {
    console.log('❌ Admin user not found!');
    console.log('Run: npx prisma db seed');
    return;
  }

  console.log('✅ Admin user found:');
  console.log('  Email:', user.email);
  console.log('  Display Name:', user.displayName);
  console.log('  Role ID:', user.roleId);
  console.log('  Role Name:', user.role?.name);
  console.log('  Role Slug:', user.role?.slug);
  console.log('  Email Verified:', user.emailVerifiedAt ? 'Yes' : 'No');
  console.log('  Active:', user.isActive ? 'Yes' : 'No');
  console.log('  Credits:', user.credits);

  if (user.role?.name !== 'ADMIN') {
    console.log('\n⚠️  WARNING: User does not have ADMIN role!');
    console.log('Fixing...');
    
    const adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' },
    });

    if (adminRole) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId: adminRole.id },
      });
      console.log('✅ Fixed! User now has ADMIN role.');
    } else {
      console.log('❌ ADMIN role not found in database!');
    }
  } else {
    console.log('\n✅ User has correct ADMIN role.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
