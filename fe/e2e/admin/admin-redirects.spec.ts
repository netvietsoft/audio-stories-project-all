import { expect, test } from "@playwright/test";

const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:3002";

test.describe("Admin redirects", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/admin -> /vi (first hop)", async ({ request }) => {
    const response = await request.get(`${ADMIN_URL}/admin`, {
      failOnStatusCode: false,
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/vi");
  });

  test("/en/admin -> /en (first hop)", async ({ request }) => {
    const response = await request.get(`${ADMIN_URL}/en/admin`, {
      failOnStatusCode: false,
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/en");
  });

  test("/vi/admin/login?reason=unauthorized -> /vi/login?reason=unauthorized", async ({ page }) => {
    await page.goto(`${ADMIN_URL}/vi/admin/login?reason=unauthorized`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/vi\/login\?reason=unauthorized$/);
  });

  test("unauthenticated /vi/users -> /vi/login?reason=unauthorized", async ({ page }) => {
    await page.goto(`${ADMIN_URL}/vi/users`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/vi\/login\?reason=unauthorized$/);
  });
});
