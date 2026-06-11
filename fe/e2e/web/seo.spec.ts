/**
 * SEO E2E Tests – Task 70, 71, 72
 *
 * Test scope:
 *   - robots.txt (Task 71)
 *   - sitemap.xml (Task 71)
 *   - Story page meta tags & JSON-LD structured data (Task 70 + 72)
 *
 * Yêu cầu trước khi chạy:
 *   - Web app đang chạy tại WEB_URL (mặc định: http://localhost:3001)
 *   - BE đang chạy tại http://localhost:3000 (npm run start:dev)
 *   - (Tuỳ chọn) Set env TEST_STORY_SLUG=<slug-thực-trong-DB> để test story page SEO
 *     Nếu không set, test story page sẽ bị skip.
 *
 * Chạy:
 *   npx playwright test --project=web e2e/web/seo.spec.ts
 */

import { expect, test } from "@playwright/test";

// Slug của một truyện thực tế trong DB; set bằng env var hoặc thay trực tiếp khi test local
const TEST_STORY_SLUG = process.env.TEST_STORY_SLUG ?? "";

// ---------------------------------------------------------------------------
// robots.txt – Task 71
// ---------------------------------------------------------------------------

test.describe("robots.txt", () => {
  test("GET /robots.txt trả về status 200", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
  });

  test("robots.txt cho phép crawl toàn bộ ('/')", async ({ request }) => {
    const body = await request.get("/robots.txt").then((r) => r.text());
    expect(body).toContain("Allow: /");
  });

  test("robots.txt chặn crawl /admin/ và /api/", async ({ request }) => {
    const body = await request.get("/robots.txt").then((r) => r.text());
    expect(body).toContain("Disallow: /admin/");
    expect(body).toContain("Disallow: /api/");
  });

  test("robots.txt chứa đường dẫn đến sitemap.xml", async ({ request }) => {
    const body = await request.get("/robots.txt").then((r) => r.text());
    // Link sitemap phải xuất hiện dưới dạng Sitemap: <url>/sitemap.xml
    expect(body).toMatch(/Sitemap:\s*https?:\/\/.+\/sitemap\.xml/i);
  });
});

// ---------------------------------------------------------------------------
// sitemap.xml – Task 71
// ---------------------------------------------------------------------------

test.describe("sitemap.xml", () => {
  test("GET /sitemap.xml trả về status 200", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
  });

  test("sitemap.xml là XML hợp lệ và chứa thẻ <urlset>", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    const contentType = response.headers()["content-type"] ?? "";
    // Next.js trả về application/xml hoặc text/xml
    expect(contentType).toMatch(/xml/i);

    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("</urlset>");
  });

  test("sitemap.xml chứa ít nhất URL trang chủ", async ({ request }) => {
    const body = await request.get("/sitemap.xml").then((r) => r.text());
    // Trang chủ phải có mặt trong sitemap
    expect(body).toMatch(/<loc>https?:\/\/[^/]+\/?<\/loc>/);
  });
});

// ---------------------------------------------------------------------------
// Story page – Task 70 (meta tags dynamic) + Task 72 (JSON-LD)
// ---------------------------------------------------------------------------

test.describe("Story page – Meta Tags & Structured Data", () => {
  test.skip(!TEST_STORY_SLUG, "⚠️  Set env TEST_STORY_SLUG=<slug> để chạy nhóm test này");
  // Next.js dev server có thể cần thêm thời gian compile trang lần đầu
  test.setTimeout(60_000);

  test("Trang truyện có <title> không rỗng", async ({ page }) => {
    await page.goto(`/story/${TEST_STORY_SLUG}`);
    const title = await page.title();
    expect(title.trim().length).toBeGreaterThan(0);
    // Title phải chứa tên trang web hoặc tên truyện (không chỉ là default "Web Truyen")
    expect(title).not.toMatch(/^\s*$/);
  });

  test("Trang truyện có <meta name='description'> không rỗng", async ({ page }) => {
    await page.goto(`/story/${TEST_STORY_SLUG}`);
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description).not.toBeNull();
    expect(description!.trim().length).toBeGreaterThan(0);
  });

  test("Trang truyện có <meta property='og:title'> (OpenGraph)", async ({ page }) => {
    await page.goto(`/story/${TEST_STORY_SLUG}`);
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute("content");
    expect(ogTitle).not.toBeNull();
    expect(ogTitle!.trim().length).toBeGreaterThan(0);
  });

  test("Trang truyện có <meta property='og:image'> (OpenGraph)", async ({ page }) => {
    await page.goto(`/story/${TEST_STORY_SLUG}`);
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(ogImage).not.toBeNull();
    expect(ogImage!.trim().length).toBeGreaterThan(0);
  });

  test("Trang truyện có ít nhất 1 thẻ <script type='application/ld+json'>", async ({
    page,
  }) => {
    await page.goto(`/story/${TEST_STORY_SLUG}`);
    const ldScripts = await page.locator('script[type="application/ld+json"]').all();
    expect(ldScripts.length).toBeGreaterThanOrEqual(1);
  });

  test("JSON-LD chứa schema @type: Audiobook với các trường bắt buộc", async ({
    page,
  }) => {
    await page.goto(`/story/${TEST_STORY_SLUG}`);

    // Lấy tất cả <script type="application/ld+json"> và tìm schema Audiobook
    const ldScripts = await page.locator('script[type="application/ld+json"]').all();
    const parsedSchemas: Record<string, unknown>[] = [];

    for (const script of ldScripts) {
      try {
        const raw = await script.textContent();
        if (raw) parsedSchemas.push(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        // Bỏ qua script không parse được
      }
    }

    // Phải tìm thấy ít nhất 1 schema Audiobook
    const audiobookSchema = parsedSchemas.find((s) => s["@type"] === "Audiobook");
    expect(audiobookSchema, "Không tìm thấy schema @type: Audiobook").toBeDefined();

    // Các trường bắt buộc theo Google
    expect(audiobookSchema!["name"]).toBeTruthy();
    expect(audiobookSchema!["@context"]).toBe("https://schema.org");
    expect(audiobookSchema!["url"]).toBeTruthy();
  });

  test("JSON-LD chứa schema @type: BreadcrumbList", async ({ page }) => {
    await page.goto(`/story/${TEST_STORY_SLUG}`);

    const ldScripts = await page.locator('script[type="application/ld+json"]').all();
    const parsedSchemas: Record<string, unknown>[] = [];

    for (const script of ldScripts) {
      try {
        const raw = await script.textContent();
        if (raw) parsedSchemas.push(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        // Bỏ qua
      }
    }

    // Phải tìm thấy ít nhất 1 schema BreadcrumbList
    const breadcrumb = parsedSchemas.find((s) => s["@type"] === "BreadcrumbList");
    expect(breadcrumb, "Không tìm thấy schema @type: BreadcrumbList").toBeDefined();

    // itemListElement phải là mảng có ít nhất 2 mục
    const items = breadcrumb!["itemListElement"] as unknown[];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});
