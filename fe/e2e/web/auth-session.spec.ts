import { expect, test, type Page } from "@playwright/test";

const WEB_URL = process.env.WEB_URL ?? process.env.FE_URL ?? "http://localhost:3001";
const BE_URL = process.env.BE_URL ?? "http://localhost:3000";
const USER_STORAGE_KEY = "user-store";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_COOKIE_NAME = "refresh_token";
const SEEDED_ACCESS_TOKEN = "seeded-access-token";
const SEEDED_USER = {
  id: "logout-user-id",
  email: "logout-user@test.local",
  name: "Logout User",
  pulseBalance: 0,
  roles: ["user"],
};

async function seedAuthenticatedSession(page: Page) {
  await page.context().addCookies([
    {
      name: ACCESS_TOKEN_KEY,
      value: SEEDED_ACCESS_TOKEN,
      url: `${WEB_URL}/`,
      httpOnly: false,
      sameSite: "Lax",
    },
    {
      name: REFRESH_COOKIE_NAME,
      value: "seeded-refresh-token",
      url: `${BE_URL}/`,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.addInitScript(
    ({ accessToken, accessTokenKey, storageKey, user }) => {
      window.localStorage.setItem(accessTokenKey, accessToken);
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: {
            user,
            accessToken,
          },
          version: 0,
        }),
      );
    },
    {
      accessToken: SEEDED_ACCESS_TOKEN,
      accessTokenKey: ACCESS_TOKEN_KEY,
      storageKey: USER_STORAGE_KEY,
      user: SEEDED_USER,
    },
  );
}

test.describe("Web logout session handling", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("explicit web logout must hit backend logout and prevent refresh reuse", async ({ page }) => {
    let logoutRequestCount = 0;
    let refreshSentCookie = false;

    await page.route("**/languages**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            { id: 0, key: "vi", name: "Tiếng Việt", isActive: true, displayOrder: 0 },
            { id: 1, key: "en", name: "English", isActive: true, displayOrder: 1 },
          ],
        }),
      });
    });

    await page.route("**/stories/categories/top**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.route("**/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }),
      });
    });

    await page.route("**/auth/logout", async (route) => {
      logoutRequestCount += 1;
      await page.context().clearCookies();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route("**/auth/refresh", async (route) => {
      const cookieHeader = route.request().headers().cookie ?? "";
      refreshSentCookie = cookieHeader.includes(`${REFRESH_COOKIE_NAME}=`);

      await route.fulfill({
        status: refreshSentCookie ? 200 : 401,
        contentType: "application/json",
        body: JSON.stringify(
          refreshSentCookie
            ? { ok: true, access_token: "rotated-access-token" }
            : { statusCode: 401, message: "Unauthorized" },
        ),
      });
    });

    await seedAuthenticatedSession(page);
    await page.goto(`${WEB_URL}/vi/story`, { waitUntil: "networkidle" });

    await expect(page.locator('button:has(img[alt="Avatar"])')).toBeVisible();

    const refreshCookiesBeforeLogout = await page.context().cookies(BE_URL);
    expect(
      refreshCookiesBeforeLogout.some((cookie) => cookie.name === REFRESH_COOKIE_NAME),
      "Precondition: seeded browser context must contain refresh_token before logout",
    ).toBe(true);

    await page.locator('button:has(img[alt="Avatar"])').click();
    await page.getByRole("button", { name: /Đăng xuất|Log out/i }).click();
    await page.waitForTimeout(300);

    expect(logoutRequestCount).toBe(1);

    const refreshProbe = await page.evaluate(async (beUrl) => {
      const response = await fetch(`${beUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      return {
        ok: response.ok,
        status: response.status,
        body,
      };
    }, BE_URL);

    expect(refreshSentCookie).toBe(false);
    expect(refreshProbe.ok).toBe(false);
    expect(refreshProbe.status).toBe(401);

    const refreshCookiesAfterLogout = await page.context().cookies(BE_URL);
    expect(
      refreshCookiesAfterLogout.some((cookie) => cookie.name === REFRESH_COOKIE_NAME),
      "Refresh cookie must be cleared after explicit logout",
    ).toBe(false);
  });
});
