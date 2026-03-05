import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding roles...');

  // Create default roles if not exist
  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: {
      name: 'USER',
      slug: 'user',
      description: 'Default user role',
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      slug: 'admin',
      description: 'Administrator role',
    },
  });

  console.log('Created default roles');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@media-ai.app';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    if (existingAdmin.roleId !== adminRole.id) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { roleId: adminRole.id },
      });
      console.log(`Assigned ADMIN role to existing user: ${adminEmail}`);
    } else {
      console.log(`Admin user already exists: ${adminEmail}`);
    }
  } else {
    const passwordHash = await argon2.hash(adminPassword);
    await prisma.user.create({
      data: {
        email: adminEmail,
        displayName: 'Admin',
        passwordHash: passwordHash,
        emailVerifiedAt: new Date(),
        roleId: adminRole.id,
      },
    });

    console.log(`Created admin user: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
