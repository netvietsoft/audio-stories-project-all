/**
 * admin-flow.spec.ts – Test luồng Middleware Protection cho Admin routes
 *
 * Bao phủ:
 * ✅ Truy cập /admin khi CHƯA đăng nhập → redirect về /admin/login
 * ✅ Truy cập /vi/admin (với locale prefix) khi chưa login → redirect
 * ✅ Truy cập /admin/login khi chưa đăng nhập → hiển thị form login
 * ✅ Truy cập /admin/dashboard khi chưa login → redirect
 *
 * Nguyên tắc kỹ thuật:
 * - Next.js middleware kiểm tra `refresh_token` cookie
 * - Nếu không có cookie → redirect sang /{locale}/admin/login?reason=unauthorized
 * - Playwright không set cookie → giả lập user chưa đăng nhập
 *
 * Yêu cầu:
 * - Next.js FE phải đang chạy tại FE_URL (mặc định: http://localhost:3001)
 */

import { test, expect } from '@playwright/test';

const FE_URL = process.env.FE_URL ?? 'http://localhost:3001';

test.describe('Admin Route Protection – Middleware (Playwright)', () => {
  // Không set cookie → giả lập trình duyệt chưa đăng nhập
  test.use({ storageState: { cookies: [], origins: [] } });

  test('✅ GET /admin (không có cookie) → redirect về /admin/login', async ({ page }) => {
    // Mở trang /admin không có cookie
    const response = await page.goto(`${FE_URL}/admin`, { waitUntil: 'networkidle' });

    // Sau redirect, URL phải chứa /admin/login
    const finalUrl = page.url();
    console.log(`[AdminFlow] Final URL: ${finalUrl}`);

    expect(
      finalUrl.includes('/admin/login'),
      `URL phải chứa /admin/login, nhận được: ${finalUrl}`
    ).toBe(true);
  });

  test('✅ GET /vi/admin (locale prefix) → redirect về /vi/admin/login', async ({ page }) => {
    await page.goto(`${FE_URL}/vi/admin`, { waitUntil: 'networkidle' });

    const finalUrl = page.url();
    console.log(`[AdminFlow] Final URL: ${finalUrl}`);

    expect(
      finalUrl.includes('/admin/login'),
      `URL phải chứa /admin/login, nhận được: ${finalUrl}`
    ).toBe(true);
  });

  test('✅ GET /admin/dashboard không có cookie → redirect về login', async ({ page }) => {
    await page.goto(`${FE_URL}/admin/dashboard`, { waitUntil: 'networkidle' });

    const finalUrl = page.url();
    expect(
      finalUrl.includes('/admin/login'),
      `URL phải chứa /admin/login, nhận được: ${finalUrl}`
    ).toBe(true);
  });

  test('✅ GET /vi/admin/login → hiển thị form đăng nhập (KHÔNG redirect)', async ({ page }) => {
    await page.goto(`${FE_URL}/vi/admin/login`, { waitUntil: 'networkidle' });

    const finalUrl = page.url();
    console.log(`[AdminFlow] Admin login page URL: ${finalUrl}`);

    // KHÔNG bị redirect đi nơi khác
    expect(
      finalUrl.includes('/admin/login'),
      `Trang /admin/login phải được hiển thị, URL: ${finalUrl}`
    ).toBe(true);

    // Trang phải có form (input email hoặc password)
    const hasInput = await page.locator('input[type="email"], input[type="text"], input[type="password"]').count();
    expect(hasInput).toBeGreaterThan(0);
  });

  test('✅ Redirect kèm ?reason=unauthorized', async ({ page }) => {
    await page.goto(`${FE_URL}/admin`, { waitUntil: 'networkidle' });

    const finalUrl = page.url();
    // Middleware set ?reason=unauthorized khi chặn admin route
    expect(
      finalUrl.includes('reason=unauthorized'),
      `Redirect URL phải chứa ?reason=unauthorized, nhận được: ${finalUrl}`
    ).toBe(true);
  });
});
