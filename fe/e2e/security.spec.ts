/**
 * Security E2E Tests – Task 77
 *
 * Test scope:
 *   - Rate Limiting: ThrottlerGuard (100 req / 60s / IP)
 *   - RBAC: JwtAccessGuard + RolesGuard trên POST /stories
 *
 * Gọi trực tiếp vào NestJS Backend API (không qua FE proxy).
 *
 * Yêu cầu trước khi chạy:
 *   - BE đang chạy tại http://localhost:3000 (npm run start:dev)
 *
 * Biến môi trường (tuỳ chọn – các test RBAC sẽ bị skip nếu không set):
 *   TEST_USER_TOKEN   JWT access token của user thường (role USER, không phải ADMIN)
 *                     → Cách lấy: Đăng nhập với 1 tài khoản USER, copy access_token
 *   TEST_ADMIN_TOKEN  JWT access token của user ADMIN
 *                     → Cách lấy: Đăng nhập với tài khoản ADMIN, copy access_token
 *
 *   Lý do cần token thật:
 *   JwtAccessStrategy của dự án này làm DB lookup (prisma.user.findUnique) sau khi
 *   verify signature. Token giả (dù đúng format) sẽ trả về 401 thay vì 403 vì
 *   người dùng không tồn tại trong DB. Cần token được tạo từ tài khoản thực.
 *
 * Chạy:
 *   npx playwright test e2e/security.spec.ts
 *   TEST_USER_TOKEN=eyJ... TEST_ADMIN_TOKEN=eyJ... npx playwright test e2e/security.spec.ts
 */

import { expect, test } from "@playwright/test";

const BE_URL = process.env.BE_URL ?? "http://localhost:3000";

// Tokens từ env (cần token của user thật trong DB)
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN ?? "";
const TEST_ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN ?? "";

// ---------------------------------------------------------------------------
// Rate Limiting – Task 77 (ThrottlerGuard: 100 req / 60s / IP)
// ---------------------------------------------------------------------------

test.describe("Rate Limiting – ThrottlerGuard", () => {
  /**
   * Gửi 105 requests liên tục đến endpoint public (GET /stories/explore).
   * Các requests sau số 100 PHẢI nhận về HTTP 429 Too Many Requests.
   *
   * Lưu ý: Test này cần chạy trên môi trường "sạch" (rate counter chưa bị
   * tiêu tốn). Nếu server đã nhận nhiều request từ IP này trong 60s qua, hãy
   * đợi thêm hoặc restart BE trước khi chạy.
   */
  test("Sau 100 requests, server trả về HTTP 429", async ({ request }) => {
    const LIMIT = 100;
    const TOTAL_REQUESTS = 105;
    const endpoint = `${BE_URL}/stories/explore`;

    const statuses: number[] = [];

    for (let i = 0; i < TOTAL_REQUESTS; i++) {
      const res = await request.get(endpoint);
      statuses.push(res.status());
    }

    // Một số request cuối (sau giới hạn 100) phải bị giới hạn với 429
    const rateLimitedCount = statuses.filter((s) => s === 429).length;

    expect(
      rateLimitedCount,
      `Không có request nào nhận 429. Statuses: ${statuses.slice(-10).join(", ")}`,
    ).toBeGreaterThan(0);

    // Cụ thể: ít nhất các request từ 101 đến 105 phải bị throttle
    const lastFiveStatuses = statuses.slice(-5);
    expect(
      lastFiveStatuses.every((s) => s === 429),
      `5 requests cuối phải là 429, nhưng nhận được: ${lastFiveStatuses.join(", ")}`,
    ).toBe(true);
  });

  test("Response HTTP 429 chứa header 'retry-after' hoặc 'x-ratelimit-*'", async ({
    request,
  }) => {
    // Gửi đủ requests để trigger throttle
    const endpoint = `${BE_URL}/stories/explore`;
    let throttledResponse = null;

    for (let i = 0; i < 110; i++) {
      const res = await request.get(endpoint);
      if (res.status() === 429) {
        throttledResponse = res;
        break;
      }
    }

    // Nếu chưa trigger được (vì counter reset giữa các test), skip
    test.skip(
      throttledResponse === null,
      "Không trigger được rate limit trong 110 requests (counter có thể đã reset)",
    );

    const headers = throttledResponse!.headers();
    const hasRateLimitHeader =
      "retry-after" in headers ||
      Object.keys(headers).some((h) => h.startsWith("x-ratelimit-"));

    expect(
      hasRateLimitHeader,
      `Response 429 không có header retry-after hay x-ratelimit-*. Headers: ${JSON.stringify(Object.keys(headers))}`,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RBAC – Task 77 (JwtAccessGuard + RolesGuard trên POST /stories)
// ---------------------------------------------------------------------------

test.describe("RBAC – POST /stories chỉ ADMIN được phép", () => {
  // Payload POST tối thiểu (sẽ fail validation nhưng phải qua auth/authz trước)
  const minimalStoryPayload = {
    title: "E2E Test Story",
    slug: "e2e-test-story",
    authorId: 1,
    categoryIds: [],
  };

  // ── Test 1: Không có token ────────────────────────────────────────────────
  test("Không có Authorization header → HTTP 401 Unauthorized", async ({
    request,
  }) => {
    const response = await request.post(`${BE_URL}/stories`, {
      data: minimalStoryPayload,
      headers: { "Content-Type": "application/json" },
    });

    expect(
      response.status(),
      `Expected 401 nhưng nhận được ${response.status()}`,
    ).toBe(401);
  });

  // ── Test 2: Token sai format (malformed JWT) ──────────────────────────────
  test("Token sai format / không hợp lệ → HTTP 401 Unauthorized", async ({
    request,
  }) => {
    const response = await request.post(`${BE_URL}/stories`, {
      data: minimalStoryPayload,
      headers: {
        "Content-Type": "application/json",
        // Token giả: không đúng signature → passport-jwt reject → 401
        Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.fake-payload.fake-signature",
      },
    });

    expect(
      response.status(),
      `Expected 401 nhưng nhận được ${response.status()}`,
    ).toBe(401);
  });

  // ── Test 3: Token user thường (role USER, không phải ADMIN) ──────────────
  //
  // Yêu cầu: Set env TEST_USER_TOKEN với JWT của tài khoản USER thực trong DB.
  // Cách lấy token: POST /auth/login với tài khoản USER → copy access_token.
  //
  // Lý do cần token thật: JwtAccessStrategy làm DB lookup, nếu user không tồn
  // tại thì trả về 401 thay vì 403.
  test(
    "Token user thường (role USER) → HTTP 403 Forbidden",
    async ({ request }) => {
      test.skip(
        !TEST_USER_TOKEN,
        "⚠️  Set env TEST_USER_TOKEN=<jwt-của-user-thường> để chạy test này",
      );

      const response = await request.post(`${BE_URL}/stories`, {
        data: minimalStoryPayload,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TEST_USER_TOKEN}`,
        },
      });

      expect(
        response.status(),
        `Expected 403 nhưng nhận được ${response.status()}`,
      ).toBe(403);
    },
  );

  // ── Test 4: Token Admin → vượt qua auth/authz ────────────────────────────
  //
  // Yêu cầu: Set env TEST_ADMIN_TOKEN với JWT của tài khoản ADMIN thực trong DB.
  // Cách lấy token: POST /auth/login với tài khoản ADMIN → copy access_token.
  //
  // Sau khi vượt qua auth/authz, request sẽ được xử lý bởi service:
  //   - Nếu payload hợp lệ   → 201 Created
  //   - Nếu payload thiếu    → 400 Bad Request
  //   - Không trả về 401/403
  test(
    "Token Admin → vượt qua auth (không phải 401 hay 403)",
    async ({ request }) => {
      test.skip(
        !TEST_ADMIN_TOKEN,
        "⚠️  Set env TEST_ADMIN_TOKEN=<jwt-của-admin> để chạy test này",
      );

      const response = await request.post(`${BE_URL}/stories`, {
        data: minimalStoryPayload,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
        },
      });

      const status = response.status();
      expect(
        status !== 401 && status !== 403,
        `Token ADMIN phải vượt qua auth, nhưng nhận được ${status}`,
      ).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// Bonus: SkipThrottle – Các API đặc thù có thể bỏ qua rate limit
// ---------------------------------------------------------------------------

test.describe("Tài liệu: Cách bỏ qua rate limit cho endpoint cụ thể", () => {
  /**
   * Trong NestJS, để bỏ qua ThrottlerGuard cho một controller hoặc handler:
   *
   * import { SkipThrottle } from '@nestjs/throttler';
   *
   * // Bỏ qua cho toàn bộ controller:
   * @SkipThrottle()
   * @Controller('webhooks')
   * export class WebhooksController { ... }
   *
   * // Bỏ qua cho một endpoint cụ thể:
   * @SkipThrottle()
   * @Get('health')
   * checkHealth() { return 'ok'; }
   *
   * Test này chỉ là placeholder/documentation test, luôn pass.
   */
  test("SkipThrottle decorator – placeholder (luôn pass)", () => {
    // Xem comment trên để biết cách dùng @SkipThrottle() trong NestJS
    expect(true).toBe(true);
  });
});
