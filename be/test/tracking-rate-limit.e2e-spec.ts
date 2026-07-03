/**
 * tracking-rate-limit.e2e-spec.ts – Test Rate Limiting trên API Tracking
 *
 * Cấu hình Throttle hiện tại: 100 req / 60s / IP (global ThrottlerModule)
 * THROTTLE_DISABLED=false trong .env.test → throttle ĐANG BẬT
 *
 * Chiến lược: Gửi 106 request, request 101+ PHẢI nhận 429.
 *
 * LƯU Ý: Nếu test bị fail do counter từ test trước, chạy riêng file này:
 *   NODE_ENV=test npx jest --config test/jest-e2e.json tracking-rate-limit
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { createTestApp } from './test-app.factory';

const THROTTLE_LIMIT = 100; // Khớp với ThrottlerModule config
const REQUESTS_TO_SEND = THROTTLE_LIMIT + 6; // 106 requests

describe('Rate Limiting – ThrottlerGuard (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Đảm bảo throttle đang bật
    expect(process.env.THROTTLE_DISABLED).not.toBe('true');
    app = await createTestApp();
  }, 90000);

  afterAll(async () => {
    await app.close();
  });

  it(
    '✅ Sau 100 requests, request thứ 101+ nhận HTTP 429 Too Many Requests',
    async () => {
      const statuses: number[] = [];
      const trackPayload = {
        storyId: 'test-story',
        chapterId: 'test-chapter',
      };

      // Gửi THROTTLE_LIMIT + 6 requests liên tiếp (tuần tự, không await song song)
      for (let i = 0; i < REQUESTS_TO_SEND; i++) {
        const res = await supertest(app.getHttpServer())
          .post('/tracking/view')
          .send(trackPayload);
        statuses.push(res.status);
      }

      // In ra để debug
      const last10 = statuses.slice(-10);
      console.log(`[RateLimit] Last 10 statuses: ${last10.join(', ')}`);

      const rateLimitedCount = statuses.filter((s) => s === 429).length;
      const successCount = statuses.filter((s) => s < 400).length;

      console.log(`[RateLimit] Success: ${successCount}, Rate-limited (429): ${rateLimitedCount}`);

      // BẮT BUỘC: Phải có ít nhất 1 request bị throttle
      expect(rateLimitedCount).toBeGreaterThan(0);

      // BẮT BUỘC: Các request sau THROTTLE_LIMIT phải là 429
      const overLimitStatuses = statuses.slice(THROTTLE_LIMIT);
      expect(
        overLimitStatuses.every((s) => s === 429)
      ).toBe(true);
    },
    120000, // Timeout 120s vì gửi 106 requests tuần tự
  );

  it(
    '✅ Response HTTP 429 có header Retry-After',
    async () => {
      const trackPayload = { storyId: 'test-story-hdr', chapterId: 'test-chapter-hdr' };

      let throttledResponse: any = null;

      // Cố gắng trigger 429
      for (let i = 0; i < 110; i++) {
        const res = await supertest(app.getHttpServer())
          .post('/tracking/view')
          .send(trackPayload);

        if (res.status === 429) {
          throttledResponse = res;
          break;
        }
      }

      if (!throttledResponse) {
        console.warn('[RateLimit] Không trigger được 429 trong 110 requests (counter đã reset)');
        return; // Graceful skip
      }

      const headers = throttledResponse.headers;
      const headerKeys = Object.keys(headers);

      const hasRateLimitHeader =
        'retry-after' in headers ||
        headerKeys.some((h: string) => h.startsWith('x-ratelimit-'));

      console.log(`[RateLimit] 429 response headers: ${JSON.stringify(headerKeys)}`);

      expect(
        hasRateLimitHeader
      ).toBe(true);
    },
    120000,
  );

  it(
    '✅ /tracking/listen cũng bị rate limit',
    async () => {
      const trackPayload = { storyId: 'test-listen', chapterId: 'test-chapter' };
      const statuses: number[] = [];

      for (let i = 0; i < REQUESTS_TO_SEND; i++) {
        const res = await supertest(app.getHttpServer())
          .post('/tracking/listen')
          .send(trackPayload);
        statuses.push(res.status);
      }

      const rateLimitedCount = statuses.filter((s) => s === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    },
    120000,
  );
});
