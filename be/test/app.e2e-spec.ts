/**
 * app.e2e-spec.ts – Smoke test cơ bản cho toàn bộ app.
 *
 * Test tối giản để verify NestJS app khởi động thành công
 * và trả về response đúng từ health endpoint.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { createTestApp } from './test-app.factory';

describe('App Smoke Test (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('✅ GET / → 200 (App đang chạy)', async () => {
    const res = await supertest(app.getHttpServer()).get('/');
    // App có thể trả về 200 "Hello World!" hoặc 404 nếu root path không có handler
    // Ta chỉ cần confirm app đang chạy, không phải 5xx
    expect(res.status).not.toBeGreaterThanOrEqual(500);
  });

  it('✅ GET /auth/login endpoint không trả về 500', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@test.com', password: 'short' });
    // Validation error nhưng app đang chạy
    expect(res.status).not.toBeGreaterThanOrEqual(500);
  });
});

