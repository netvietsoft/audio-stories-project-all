/**
 * global-teardown.ts – Chạy 1 lần sau khi TOÀN BỘ test suite kết thúc.
 *
 * Nhiệm vụ: Dọn dẹp database test (tùy chọn).
 * Mặc định: Để lại DB để debug. Có thể bật xóa qua env E2E_CLEANUP=true
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env.test');
dotenv.config({ path: envPath, override: true });

export default async function globalTeardown() {
  if (process.env.E2E_CLEANUP === 'true') {
    const { execSync } = await import('child_process');
    const prismaPath = path.resolve(__dirname, '../node_modules/.bin/prisma');
    const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
    const dbUrl = process.env.DATABASE_URL ?? '';

    console.log('\n[GlobalTeardown] 🧹 Dọn dẹp database test...');
    try {
      execSync(
        `${prismaPath} migrate reset --force --schema="${schemaPath}"`,
        {
          cwd: path.resolve(__dirname, '..'),
          env: { ...process.env, DATABASE_URL: dbUrl },
          stdio: 'pipe',
        }
      );
      console.log('[GlobalTeardown] ✅ Database test đã được reset.');
    } catch (err: any) {
      console.warn(`[GlobalTeardown] ⚠️  Không thể dọn DB: ${err.message}`);
    }
  } else {
    console.log('\n[GlobalTeardown] ℹ️  Giữ lại database test để debug.');
    console.log('[GlobalTeardown]    Set E2E_CLEANUP=true để xóa sau khi test.');
  }
}
