import type { Prisma } from '@prisma/client';

const config: Prisma.PrismaClientOptions = {
  datasourceUrl: process.env.DATABASE_URL,
};

export default config;
