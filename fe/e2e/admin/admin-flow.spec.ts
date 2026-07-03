/**
 * admin-flow.spec.ts – Test luồng auth cơ bản cho admin app
 *
 * Bao phủ:
 * ✅ Truy cập /vi/login khi CHƯA đăng nhập → hiển thị form login
 * ✅ Truy cập /vi/users khi CHƯA đăng nhập → redirect về /vi/login?reason=unauthorized
 *
 * Yêu cầu:
 * - Admin app đang chạy tại ADMIN_URL (mặc định: http://localhost:3002)
 */

import { expect, test } from "@playwright/test";

const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:3002";

test.describe("Admin Auth Flow (Playwright)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("✅ GET /vi/login → hiển thị form đăng nhập", async ({ page }) => {
    await page.goto(`${ADMIN_URL}/vi/login`, { waitUntil: "networkidle" });

    await expect(page).toHaveURL(/\/vi\/login(?:\?.*)?$/);
    await expect(page.locator('input[type="email"], input[type="text"], input[type="password"]').first()).toBeVisible();
  });

  test("✅ GET /vi/users không có cookie → redirect về /vi/login?reason=unauthorized", async ({ page }) => {
    await page.goto(`${ADMIN_URL}/vi/users`, { waitUntil: "networkidle" });

    await expect(page).toHaveURL(/\/vi\/login\?reason=unauthorized$/);
  });
});
