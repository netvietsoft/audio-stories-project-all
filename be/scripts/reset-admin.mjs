// Reset an admin password (local dev) so you can log in.
// Run from be/:  node scripts/reset-admin.mjs <email> <newPassword>
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const email = process.argv[2];
const newPw = process.argv[3];

if (!email || !newPw) {
  console.error('Usage: node scripts/reset-admin.mjs <email> <newPassword>');
  process.exit(1);
}

const hash = await argon2.hash(newPw);
// Also mark email verified (loginLocal rejects unverified emails).
const n = await prisma.$executeRawUnsafe(
  'UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, NOW(3)) WHERE email = ?',
  hash,
  email,
);
console.log('rows updated:', n, '| email:', email);
await prisma.$disconnect();
