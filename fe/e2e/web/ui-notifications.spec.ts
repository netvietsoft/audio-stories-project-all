import { expect, test } from "@playwright/test";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_STORE_KEY = "user-store";

const MOCK_ACCESS_TOKEN = "mock-access-token-user-a";
const MOCK_REFRESH_TOKEN = "mock-refresh-token-user-a";

const mockUser = {
  id: "user-a-id",
  email: "user-a@test.local",
  name: "User A",
  avatarUrl: "",
  roles: ["USER"],
  credits: 0,
};

const unreadNotifications = [
  {
    id: "n1",
    title: "Thong bao 1",
    body: "Ban co thong bao chua doc 1",
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "n2",
    title: "Thong bao 2",
    body: "Ban co thong bao chua doc 2",
    isRead: false,
    createdAt: new Date().toISOString(),
  },
];

const readNotifications = unreadNotifications.map((item) => ({ ...item, isRead: true }));

const notificationsApiPattern = /\/api\/notifications(\?.*)?$|\/notifications(\?.*)?$/;
const readAllApiPattern = /\/api\/notifications\/read-all$|\/notifications\/read-all$/;

function visibleBellButton(page: any) {
  return page.locator("button:visible").filter({ has: page.locator("svg.lucide-bell") }).first();
}

async function seedLoggedInState(context: any) {
  await context.addCookies([
    {
      name: ACCESS_TOKEN_KEY,
      value: MOCK_ACCESS_TOKEN,
      url: "http://localhost:3001",
      httpOnly: false,
      sameSite: "Lax",
    },
    {
      name: REFRESH_TOKEN_KEY,
      value: MOCK_REFRESH_TOKEN,
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await context.addInitScript(
    ({ accessToken, refreshToken, user }: { accessToken: string; refreshToken: string; user: any }) => {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem(
        "user-store",
        JSON.stringify({
          state: {
            user,
            accessToken,
            refreshToken,
          },
          version: 0,
        }),
      );
    },
    {
      accessToken: MOCK_ACCESS_TOKEN,
      refreshToken: MOCK_REFRESH_TOKEN,
      user: mockUser,
    },
  );
}

test.describe("Notifications UI E2E", () => {
  test.use({ viewport: { width: 1600, height: 1200 } });

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await seedLoggedInState(context);

    // Auth bootstrap gọi /auth/me khi có token; mock để tránh phụ thuộc backend state.
    await page.route(/\/api\/auth\/me$|\/auth\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sub: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          roles: mockUser.roles,
          credits: mockUser.credits,
          allow_bell_noti: true,
          allow_email_noti: true,
        }),
      });
    });
  });

  test("Hiển thị badge trên chuông khi có 2 notifications chưa đọc", async ({ page }) => {
    await page.route(notificationsApiPattern, async (route) => {
      const rt = route.request().resourceType();
      if (rt !== "fetch" && rt !== "xhr") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: unreadNotifications,
          meta: {
            unreadCount: 2,
            total: 2,
            page: 1,
            lastPage: 1,
          },
        }),
      });
    });

    await page.goto("/");

    // UI hiện tại hiển thị chấm đỏ thay vì số; assert badge tồn tại để đảm bảo unread state hoạt động.
    const bellButton = visibleBellButton(page);
    await expect(bellButton).toBeVisible();
    await expect(bellButton.locator("span.bg-red-500")).toBeVisible();

    // Mở dropdown và xác nhận có đúng 2 item unread được render.
    await bellButton.click();
    await expect(page.getByText("Thong bao 1")).toBeVisible();
    await expect(page.getByText("Thong bao 2")).toBeVisible();
  });

  test("Trang danh sách: render đầy đủ, gọi read-all API, badge biến mất và item chuyển style đã đọc", async ({
    page,
  }) => {
    let readAllCalled = false;

    await page.route(notificationsApiPattern, async (route) => {
      const rt = route.request().resourceType();
      if (rt !== "fetch" && rt !== "xhr") {
        await route.continue();
        return;
      }

      const body = readAllCalled
        ? {
            data: readNotifications,
            meta: { unreadCount: 0, total: 2, page: 1, lastPage: 1 },
          }
        : {
            data: unreadNotifications,
            meta: { unreadCount: 2, total: 2, page: 1, lastPage: 1 },
          };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.route(readAllApiPattern, async (route) => {
      const rt = route.request().resourceType();
      if (rt !== "fetch" && rt !== "xhr") {
        await route.continue();
        return;
      }

      readAllCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, count: 2 }),
      });
    });

    // Trước khi mark-all: ở trang chủ phải còn badge unread.
    await page.goto("/");
    const homeBellBefore = visibleBellButton(page);
    await expect(homeBellBefore.locator("span.bg-red-500")).toBeVisible();

    await page.goto("/vi/notifications");

    await expect(page.getByText("Thong bao 1")).toBeVisible();
    await expect(page.getByText("Thong bao 2")).toBeVisible();

    const markAllBtn = page
      .getByRole("button", { name: /Danh dau da doc tat ca|Đánh dấu tất cả đã đọc/i })
      .first();
    await expect(markAllBtn).toBeVisible();
    await markAllBtn.click();

    await expect.poll(() => readAllCalled).toBe(true);

    // Các items chuyển sang style đã đọc (không còn nền xanh unread).
    const notif1Container = page.getByText("Thong bao 1").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    const notif2Container = page.getByText("Thong bao 2").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");

    await expect(notif1Container).toHaveClass(/bg-white/);
    await expect(notif2Container).toHaveClass(/bg-white/);
    await expect(notif1Container).not.toHaveClass(/bg-blue/);
    await expect(notif2Container).not.toHaveClass(/bg-blue/);

  // Sau khi mark-all, quay lại trang chủ: badge unread trên chuông nên biến mất.
  await page.goto("/");
  const homeBellAfter = visibleBellButton(page);
  await expect(homeBellAfter.locator("span.bg-red-500")).toHaveCount(0);
  });
});
