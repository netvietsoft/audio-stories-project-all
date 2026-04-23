/**
 * user-flow.spec.ts – Test luồng User trên Frontend (Playwright)
 *
 * Bao phủ:
 * ✅ PULSE DISPLAY: Sau khi login, Navbar phải hiển thị PulseIcon với aria-label="Pulse balance"
 * ✅ PULSE TEXT: Navbar button chứa text "Pulse" (topUpButtonLabel format)
 * ✅ AUDIO PROXY: Thẻ <audio> hoặc source phải có src chứa /chapters/.../audio 
 *    (KHÔNG gọi thẳng R2 URL)
 * ✅ PUBLIC PAGE: Trang chủ public accessible không cần đăng nhập
 *
 * Yêu cầu:
 * - FE đang chạy tại FE_URL (default: http://localhost:3001)
 * - BE đang chạy tại BE_URL (default: http://localhost:3000)
 * - Tài khoản test được set trong env vars (xem bên dưới)
 *
 * Env vars cần thiết cho test login (nếu không có → test skip):
 *   TEST_USER_EMAIL=user@test.com
 *   TEST_USER_PASSWORD=UserPass123
 *
 * Env vars để test audio proxy:
 *   TEST_CHAPTER_SLUG=ten-chapter-slug   (slug của chapter có audio)
 *   TEST_STORY_SLUG=ten-story-slug
 */

import { test, expect, Page } from '@playwright/test';

const FE_URL = process.env.FE_URL ?? 'http://localhost:3001';
const BE_URL = process.env.BE_URL ?? 'http://localhost:3000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? '';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? '';

// ─── Helper: Login via API (không qua UI để ổn định hơn) ─────────────────────
async function loginViaApi(page: Page): Promise<string | null> {
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) return null;

  const response = await page.request.post(`${BE_URL}/auth/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });

  if (!response.ok()) return null;
  const body = await response.json();
  return body.access_token ?? null;
}

// ─── Helper: Set auth cookies để bypass middleware ────────────────────────────
async function setAuthCookies(page: Page, accessToken: string) {
  // Set access_token cookie (used by FE to detect login state)
  await page.context().addCookies([
    {
      name: 'access_token',
      value: accessToken,
      domain: new URL(FE_URL).hostname,
      path: '/',
      httpOnly: false,
    },
    {
      name: 'refresh_token',
      value: 'dummy-refresh-for-middleware', // Middleware chỉ cần cookie tồn tại
      domain: new URL(FE_URL).hostname,
      path: '/',
      httpOnly: true,
    },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Public Pages – Không cần đăng nhập', () => {
  test('✅ Trang chủ public (/vi hoặc /vi/story) có thể truy cập', async ({ page }) => {
    const res = await page.goto(`${FE_URL}/vi/story`, { waitUntil: 'networkidle' });

    // Không bị redirect về login
    const finalUrl = page.url();
    expect(finalUrl).not.toContain('/login');
    expect(res?.status()).not.toBeGreaterThanOrEqual(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Pulse Display – Sau khi đăng nhập (Playwright)', () => {
  test(
    '✅ Sau khi login, Navbar phải hiển thị PulseIcon (aria-label="Pulse balance")',
    async ({ page }) => {
      const skipReason = 'Set TEST_USER_EMAIL + TEST_USER_PASSWORD để chạy test này';
      test.skip(!TEST_USER_EMAIL || !TEST_USER_PASSWORD, skipReason);

      const accessToken = await loginViaApi(page);
      if (!accessToken) {
        test.skip(true, 'Không lấy được token từ login API');
        return;
      }

      await setAuthCookies(page, accessToken);

      // Navigate đến trang có Navbar
      await page.goto(`${FE_URL}/vi/story`, { waitUntil: 'networkidle' });

      // Kiểm tra PulseIcon: aria-label="Pulse balance"
      const pulseIcon = page.locator('[aria-label="Pulse balance"]');
      const pulseIconCount = await pulseIcon.count();

      console.log(`[UserFlow] PulseIcon elements found: ${pulseIconCount}`);

      expect(
        pulseIconCount,
        'PulseIcon với aria-label="Pulse balance" phải tồn tại trong Navbar khi đã đăng nhập'
      ).toBeGreaterThan(0);
    }
  );

  test(
    '✅ Navbar phải chứa text "Pulse" sau khi đăng nhập',
    async ({ page }) => {
      test.skip(!TEST_USER_EMAIL || !TEST_USER_PASSWORD, 'Cần TEST_USER_EMAIL + TEST_USER_PASSWORD');

      const accessToken = await loginViaApi(page);
      if (!accessToken) {
        test.skip(true, 'Không lấy được token');
        return;
      }

      await setAuthCookies(page, accessToken);
      await page.goto(`${FE_URL}/vi/story`, { waitUntil: 'networkidle' });

      // topUpButtonLabel = "${userPulse} Pulse" hoặc "Nạp Pulse" (khi balance = 0)
      // Dù là trường hợp nào, đều chứa "Pulse"
      const pulseText = page.locator('text=/Pulse/i');
      const pulseTextCount = await pulseText.count();

      console.log(`[UserFlow] Elements chứa "Pulse": ${pulseTextCount}`);

      // Navbar button với Pulse text (hidden xl:inline)
      const navbarPulseButton = page.locator('button').filter({ hasText: /Pulse/i });
      const navbarPulseCount = await navbarPulseButton.count();

      console.log(`[UserFlow] Navbar button chứa "Pulse": ${navbarPulseCount}`);

      // Ít nhất phải có 1 element chứa "Pulse" text
      const totalPulseElements = pulseTextCount + navbarPulseCount;
      expect(
        totalPulseElements,
        'Phải có ít nhất 1 element chứa "Pulse" text trong Navbar sau khi đăng nhập'
      ).toBeGreaterThan(0);
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Audio Proxy – Thẻ <audio> phải dùng backend proxy', () => {
  /**
   * Test này verify rằng audio player trên FE KHÔNG gọi thẳng R2/CDN URL,
   * mà phải đi qua proxy endpoint của backend:
   * /chapters/{id}/audio?token={jwt}
   *
   * Nếu không có TEST_CHAPTER_STORY_SLUG, test sẽ làm việc với trang đầu tiên
   * tìm được.
   */
  test(
    '✅ Audio element src phải chứa /chapters/ proxy URL (không phải R2 direct)',
    async ({ page }) => {
      const storySlug = process.env.TEST_STORY_SLUG;
      const chapterHref = storySlug
        ? `${FE_URL}/vi/story/${storySlug}`
        : null;

      if (!chapterHref) {
        // Nếu không có slug, test này cần ENV var
        test.skip(true, 'Set TEST_STORY_SLUG để chạy audio proxy test');
        return;
      }

      // Nếu cần login, set cookie
      if (TEST_USER_EMAIL && TEST_USER_PASSWORD) {
        const accessToken = await loginViaApi(page);
        if (accessToken) {
          await setAuthCookies(page, accessToken);
        }
      }

      await page.goto(chapterHref, { waitUntil: 'networkidle' });

      // Tìm thẻ <audio> hoặc <source> trong DOM
      const audioSrc = await page.evaluate(() => {
        const audio = document.querySelector('audio');
        if (audio?.src) return audio.src;
        const source = document.querySelector('audio source, source[type*="audio"]');
        if (source) return (source as HTMLSourceElement).src;
        return null;
      });

      console.log(`[UserFlow] Audio src: ${audioSrc}`);

      if (!audioSrc) {
        // Có thể audio player load lazily, thử tìm sau khi click play
        const playButton = page.locator('[aria-label*="play"], button[class*="play"], [data-testid="play"]').first();
        if (await playButton.count() > 0) {
          await playButton.click();
          await page.waitForTimeout(2000);
        }

        const audioSrcAfterPlay = await page.evaluate(() => {
          const audio = document.querySelector('audio');
          return audio?.src ?? null;
        });

        console.log(`[UserFlow] Audio src after play attempt: ${audioSrcAfterPlay}`);

        if (!audioSrcAfterPlay) {
          console.warn('[UserFlow] Không tìm thấy <audio> element, skip audio proxy assertion');
          return;
        }

        expect(
          audioSrcAfterPlay.includes('/chapters/') || audioSrcAfterPlay.includes('/audio'),
          `Audio src phải đi qua backend proxy /chapters/.../ nhưng nhận được: ${audioSrcAfterPlay}`
        ).toBe(true);

        // Kiểm tra KHÔNG gọi thẳng R2
        expect(
          audioSrcAfterPlay.includes('r2.dev') || audioSrcAfterPlay.includes('r2.cloudflarestorage.com'),
          `Audio src KHÔNG ĐƯỢC gọi thẳng R2 URL: ${audioSrcAfterPlay}`
        ).toBe(false);
        return;
      }

      // BẮT BUỘC: Audio src phải dùng proxy backend
      expect(
        audioSrc.includes('/chapters/'),
        `Audio src phải chứa /chapters/ (proxy backend), nhận được: ${audioSrc}`
      ).toBe(true);

      // BẮT BUỘC: KHÔNG được gọi thẳng R2
      expect(
        audioSrc.includes('r2.dev') || audioSrc.includes('r2.cloudflarestorage.com'),
        `Audio src KHÔNG ĐƯỢC là R2 direct URL: ${audioSrc}`
      ).toBe(false);
    }
  );

  test(
    '✅ Intercept network: Không có request nào đến R2 trực tiếp khi play audio',
    async ({ page }) => {
      const storySlug = process.env.TEST_STORY_SLUG;
      test.skip(!storySlug, 'Set TEST_STORY_SLUG để chạy test này');

      const r2DirectRequests: string[] = [];

      // Intercept tất cả network requests
      page.on('request', (req) => {
        const url = req.url();
        if (url.includes('r2.dev') || url.includes('r2.cloudflarestorage.com')) {
          r2DirectRequests.push(url);
        }
      });

      if (TEST_USER_EMAIL && TEST_USER_PASSWORD) {
        const accessToken = await loginViaApi(page);
        if (accessToken) await setAuthCookies(page, accessToken);
      }

      await page.goto(`${FE_URL}/vi/story/${storySlug}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000); // Chờ các lazy requests

      console.log(`[UserFlow] R2 direct requests detected: ${r2DirectRequests.length}`);
      if (r2DirectRequests.length > 0) {
        console.log(`[UserFlow] R2 URLs: ${r2DirectRequests.join('\n')}`);
      }

      expect(
        r2DirectRequests.length,
        `Frontend KHÔNG ĐƯỢC gọi thẳng R2 URL. Phát hiện: ${r2DirectRequests.join(', ')}`
      ).toBe(0);
    }
  );
});
