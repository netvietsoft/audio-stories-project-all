/**
 * Playwright E2E Configuration
 *
 * LÀM SAO CHẠY TEST:
 *   # Khởi động web (3001), admin (3002), BE (3000) theo project cần test
 *   npx playwright test                       # chạy tất cả projects
 *   npx playwright test --project=web        # chỉ web specs
 *   npx playwright test --project=admin      # chỉ admin specs
 *   npx playwright test --project=api        # chỉ api specs
 *   npx playwright test --list               # inspect test discovery
 *
 * BIẾN MÔI TRƯỜNG (tuỳ chọn):
 *   WEB_URL=http://localhost:3001            # web app
 *   ADMIN_URL=http://localhost:3002          # admin app
 *   BE_URL=http://localhost:3000             # backend API
 *   PLAYWRIGHT_CHANNEL=chrome                 # optional: use installed Chrome instead of bundled Chromium
 */

import { defineConfig, devices } from "@playwright/test";

const WEB_URL = process.env.WEB_URL ?? process.env.FE_URL ?? "http://localhost:3001";
const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:3002";
const BE_URL = process.env.BE_URL ?? "http://localhost:3000";
const PLAYWRIGHT_CHANNEL = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "web",
      testMatch: /web\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(PLAYWRIGHT_CHANNEL ? { channel: PLAYWRIGHT_CHANNEL } : {}),
        baseURL: WEB_URL,
      },
    },
    {
      name: "admin",
      testMatch: /admin\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(PLAYWRIGHT_CHANNEL ? { channel: PLAYWRIGHT_CHANNEL } : {}),
        baseURL: ADMIN_URL,
      },
    },
    {
      name: "api",
      testMatch: /api\/.*\.spec\.ts/,
      use: {
        baseURL: BE_URL,
      },
    },
  ],
});
