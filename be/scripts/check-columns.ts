import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('Checking database columns...\n');

  try {
    // Try to query with the new columns
    const result = await prisma.$queryRaw`
      SHOW COLUMNS FROM users LIKE '%customer_id%'
    `;
    
    console.log('Columns with "customer_id":');
    console.log(result);

    // Try to select from users table
    const user = await prisma.$queryRaw`
      SELECT id, email, stripe_customer_id, paypal_customer_id 
      FROM users 
      LIMIT 1
    `;
    
    console.log('\nSample user data:');
    console.log(user);
  } catch (error) {
    console.error('Error:', error);
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
