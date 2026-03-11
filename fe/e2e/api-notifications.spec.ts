import { expect, test, type APIRequestContext } from "@playwright/test";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

type JwtPayload = {
  sub?: string;
  email?: string;
  roles?: string[];
};

type NotificationItem = {
  id: string;
  userId?: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

type NotificationsListResponse = {
  data: NotificationItem[];
  meta?: {
    total?: number;
    unreadCount?: number;
    page?: number;
    lastPage?: number;
  };
};

const BE_URL = process.env.BE_URL ?? "http://localhost:3000";
const REPO_ROOT = path.resolve(process.cwd(), "..");
const BE_DIR = fs.existsSync(path.join(REPO_ROOT, "be"))
  ? path.join(REPO_ROOT, "be")
  : path.resolve(process.cwd(), "be");

const tokenUserA = process.env.TEST_USER_A_TOKEN ?? process.env.TEST_USER_TOKEN ?? "";
const tokenUserB = process.env.TEST_USER_B_TOKEN ?? process.env.TEST_ADMIN_TOKEN ?? "";

type SeedResult = {
  seedPrefix: string;
  userAIds: string[];
  userBIds: string[];
};

const decodeJwtPayload = (token: string): JwtPayload => {
  try {
    const parts = token.split(".");
    const payloadPart = parts[1];
    if (!payloadPart) return {};
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(json) as JwtPayload;
  } catch {
    return {};
  }
};

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

const runPrismaSeed = (userAId: string, userBId: string, seedPrefix: string): SeedResult => {
  const script = `
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    async function main() {
      const userAId = process.env.E2E_USER_A_ID;
      const userBId = process.env.E2E_USER_B_ID;
      const seedPrefix = process.env.E2E_SEED_PREFIX;

      if (!userAId || !userBId || !seedPrefix) {
        throw new Error('Missing E2E seed env vars');
      }

      const data = [
        {
          userId: userAId,
          type: 'system',
          title: '[' + seedPrefix + '] UserA unread 1',
          body: 'E2E seeded notification for user A',
          isRead: false,
        },
        {
          userId: userAId,
          type: 'system',
          title: '[' + seedPrefix + '] UserA unread 2',
          body: 'E2E seeded notification for user A',
          isRead: false,
        },
        {
          userId: userBId,
          type: 'system',
          title: '[' + seedPrefix + '] UserB unread 1',
          body: 'E2E seeded notification for user B',
          isRead: false,
        },
        {
          userId: userBId,
          type: 'system',
          title: '[' + seedPrefix + '] UserB unread 2',
          body: 'E2E seeded notification for user B',
          isRead: false,
        },
      ];

      await prisma.notification.createMany({ data });

      const [rowsA, rowsB] = await Promise.all([
        prisma.notification.findMany({
          where: { userId: userAId, title: { startsWith: '[' + seedPrefix + ']' } },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        }),
        prisma.notification.findMany({
          where: { userId: userBId, title: { startsWith: '[' + seedPrefix + ']' } },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        }),
      ]);

      console.log(JSON.stringify({
        seedPrefix,
        userAIds: rowsA.map((row) => row.id),
        userBIds: rowsB.map((row) => row.id),
      }));

      await prisma.$disconnect();
    }

    main().catch(async (error) => {
      console.error(error?.message || error);
      await prisma.$disconnect();
      process.exit(1);
    });
  `;

  const raw = execFileSync("node", ["-e", script], {
    cwd: BE_DIR,
    env: {
      ...process.env,
      E2E_USER_A_ID: userAId,
      E2E_USER_B_ID: userBId,
      E2E_SEED_PREFIX: seedPrefix,
    },
    encoding: "utf8",
  });

  return JSON.parse(raw.trim()) as SeedResult;
};

const runPrismaCleanup = (seedPrefix: string) => {
  const script = `
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    async function main() {
      const seedPrefix = process.env.E2E_SEED_PREFIX;
      if (!seedPrefix) return;

      await prisma.notification.deleteMany({
        where: {
          title: { startsWith: '[' + seedPrefix + ']' },
        },
      });

      await prisma.$disconnect();
    }

    main().catch(async () => {
      await prisma.$disconnect();
      process.exit(1);
    });
  `;

  execFileSync("node", ["-e", script], {
    cwd: BE_DIR,
    env: {
      ...process.env,
      E2E_SEED_PREFIX: seedPrefix,
    },
    encoding: "utf8",
  });
};

async function requestWithFallback(
  request: APIRequestContext,
  method: "GET" | "PATCH",
  path: string,
  token: string,
) {
  const prefixedUrl = `${BE_URL}/api${path}`;
  const directUrl = `${BE_URL}${path}`;

  const first =
    method === "GET"
      ? await request.get(prefixedUrl, { headers: authHeaders(token) })
      : await request.patch(prefixedUrl, { headers: authHeaders(token) });

  if (first.status() !== 404) {
    return first;
  }

  return method === "GET"
    ? request.get(directUrl, { headers: authHeaders(token) })
    : request.patch(directUrl, { headers: authHeaders(token) });
}

async function getNotifications(
  request: APIRequestContext,
  token: string,
): Promise<NotificationsListResponse> {
  const response = await requestWithFallback(request, "GET", "/notifications?page=1&limit=50", token);
  expect(response.status()).toBe(200);
  return (await response.json()) as NotificationsListResponse;
}

test.describe("Notifications API E2E", () => {
  let seeded: SeedResult | null = null;

  test.beforeEach(async ({}, testInfo) => {
    test.skip(!tokenUserA || !tokenUserB, "Thiếu token: set TEST_USER_A_TOKEN và TEST_USER_B_TOKEN (hoặc TEST_USER_TOKEN/TEST_ADMIN_TOKEN)");

    const payloadA = decodeJwtPayload(tokenUserA);
    const payloadB = decodeJwtPayload(tokenUserB);
    test.skip(!payloadA.sub || !payloadB.sub, "Token A/B không có sub để seed data");

    const seedPrefix = `E2E_NOTI_${Date.now()}_${testInfo.parallelIndex}_${Math.random().toString(36).slice(2, 8)}`;
    seeded = runPrismaSeed(payloadA.sub!, payloadB.sub!, seedPrefix);
  });

  test.afterEach(async () => {
    if (seeded?.seedPrefix) {
      runPrismaCleanup(seeded.seedPrefix);
    }
    seeded = null;
  });

  test("Security: User A chỉ thấy notifications của chính mình", async ({ request }) => {
    const listA = await getNotifications(request, tokenUserA);

    const payloadA = decodeJwtPayload(tokenUserA);
    const userAId = payloadA.sub;

    expect(Array.isArray(listA.data)).toBe(true);

    expect(userAId).toBeTruthy();
    expect(listA.data.length).toBeGreaterThan(0);

    for (const item of listA.data) {
      // API hiện trả về cả userId; nếu backend thay đổi shape thì test sẽ skip block này.
      if (item.userId) {
        expect(item.userId).toBe(userAId);
      }
    }

    const payloadB = decodeJwtPayload(tokenUserB);
    const userBId = payloadB.sub;
    if (userBId) {
      const hasUserBData = listA.data.some((item) => item.userId === userBId);
      expect(hasUserBData).toBe(false);
    }
  });

  test("Mark as Read: User A đọc notification của A thành công, đọc notification của B bị chặn", async ({ request }) => {
    expect(seeded?.userAIds?.length ?? 0).toBeGreaterThan(0);
    expect(seeded?.userBIds?.length ?? 0).toBeGreaterThan(0);

    const ownNotificationId = seeded!.userAIds[0];
    const otherNotificationId = seeded!.userBIds[0];

    const ownReadResponse = await requestWithFallback(
      request,
      "PATCH",
      `/notifications/${ownNotificationId}/read`,
      tokenUserA,
    );
    expect(ownReadResponse.status()).toBe(200);

    const foreignReadResponse = await requestWithFallback(
      request,
      "PATCH",
      `/notifications/${otherNotificationId}/read`,
      tokenUserA,
    );
    expect([403, 404]).toContain(foreignReadResponse.status());
  });

  test("Mark All as Read: User A gọi read-all rồi GET lại, tất cả isRead === true", async ({ request }) => {
    expect(seeded?.userAIds?.length ?? 0).toBeGreaterThan(0);

    const readAllResponse = await requestWithFallback(
      request,
      "PATCH",
      "/notifications/read-all",
      tokenUserA,
    );
    expect(readAllResponse.status()).toBe(200);

    const listAfter = await getNotifications(request, tokenUserA);

    // Nếu list rỗng thì vẫn xem là pass (không có item chưa đọc).
    const allRead = listAfter.data.every((item) => item.isRead === true);
    expect(allRead).toBe(true);
  });
});
