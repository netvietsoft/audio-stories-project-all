/**
 * Playwright E2E Configuration
 *
 * LÀM SAO CHẠY TEST:
 *   # Khởi động FE (port 3001) và BE (port 3000) trước
 *   npx playwright test                    # chạy tất cả
 *   npx playwright test e2e/seo.spec.ts    # chỉ SEO tests
 *   npx playwright test e2e/security.spec.ts # chỉ security tests
 *   npx playwright test --ui               # mở Playwright UI
 *   npx playwright show-report             # xem HTML report sau khi chạy
 *
 * BIẾN MÔI TRƯỜNG (tuỳ chọn cho security tests):
 *   TEST_STORY_SLUG=ten-truyen-slug          # slug thực sự trong DB để test SEO page
 *   TEST_USER_TOKEN=eyJ...                   # JWT access token của user thường (không ADMIN)
 *   TEST_ADMIN_TOKEN=eyJ...                  # JWT access token của user ADMIN
 *   BE_URL=http://localhost:3000             # URL của NestJS backend (mặc định)
 *   FE_URL=http://localhost:3001             # URL của Next.js frontend (mặc định)
 */

import { defineConfig, devices } from "@playwright/test";

const FE_URL = process.env.FE_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",

  // Timeout mỗi test case
  timeout: 30_000,

  // Không retry khi chạy local; CI nên set retries: 2
  retries: 0,

  // Chạy song song các file test (workers = 1 để tránh race condition khi test rate limit)
  fullyParallel: false,
  workers: 1,

  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  use: {
    // Địa chỉ FE để page.goto('/robots.txt') hoạt động đúng
    baseURL: FE_URL,

    // Ghi screenshot khi test fail
    screenshot: "only-on-failure",

    // Trace để debug khi fail
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
