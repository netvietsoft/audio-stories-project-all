/**
 * auth.e2e-spec.ts – Test luồng Authentication & Token
 *
 * Bao phủ:
 * ✅ POST /auth/login trả về 200 + access_token trong body
 * ✅ POST /auth/login đặt refresh_token trong Set-Cookie với HttpOnly flag
 * ✅ POST /auth/login sai password → 401
 * ✅ POST /auth/login email không tồn tại → 401
 * ✅ POST /auth/login email chưa verify → 403
 * ✅ GET /auth/me không có token → 401
 * ✅ GET /auth/me với access_token hợp lệ → 200 + user info
 * ✅ GET /auth/me với token hết hạn/sai → 401
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { createTestApp, getPrisma } from './test-app.factory';
import * as argon2 from 'argon2';

// ─── Constants ───────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'e2e-admin@test.local';
const ADMIN_PASSWORD = 'Admin@1234Test';
const USER_EMAIL = 'e2e-user@test.local';

describe('Auth API (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Luồng Login ─────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('✅ Login hợp lệ → trả về 200 với access_token trong body', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('access_token');
      expect(typeof res.body.access_token).toBe('string');
      expect(res.body.access_token.split('.').length).toBe(3); // JWT format
    });

    it('✅ Login hợp lệ → refresh_token PHẢI nằm trong Set-Cookie (HttpOnly)', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      expect(res.status).toBe(200);

      const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
      expect(setCookieHeader).toBeDefined();

      // Normalize về array
      const cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader as string];

      const refreshCookie = cookies.find((c) => c.includes('refresh_token='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie!.toLowerCase()).toContain('httponly');
    });

    it('❌ Sai password → 401 Unauthorized', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
    });

    it('❌ Email không tồn tại → 401 Unauthorized', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@nonexistent.test', password: 'anything' });

      expect(res.status).toBe(401);
    });

    it('❌ User chưa verify email → 403 Forbidden', async () => {
      // Tạo user chưa verify trực tiếp trong DB
      const prisma = getPrisma(app);
      const unverifiedEmail = 'unverified-e2e@test.local';

      const userRole = await prisma.role.findUnique({ where: { slug: 'user' } });
      const passwordHash = await argon2.hash('Test@1234');

      await prisma.user.upsert({
        where: { email: unverifiedEmail },
        update: { emailVerifiedAt: null, passwordHash },
        create: {
          email: unverifiedEmail,
          displayName: 'Unverified',
          passwordHash,
          emailVerifiedAt: null, // Chưa verify
          roleId: userRole!.id,
        },
      });

      const res = await supertest(app.getHttpServer())
        .post('/auth/login')
        .send({ email: unverifiedEmail, password: 'Test@1234' });

      expect(res.status).toBe(403);
    });

    it('❌ Thiếu email field → 400 Bad Request', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/auth/login')
        .send({ password: 'something' });

      expect(res.status).toBe(400);
    });
  });

  // ─── Luồng GET /auth/me ───────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await supertest(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      accessToken = res.body.access_token;
    });

    it('✅ Có token hợp lệ → 200 + thông tin user', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', ADMIN_EMAIL);
    });

    it('❌ Không có token → 401 Unauthorized', async () => {
      const res = await supertest(app.getHttpServer()).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('❌ Token giả/sai signature → 401 Unauthorized', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
    });

    it('❌ Bearer prefix thiếu → 401 Unauthorized', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', accessToken); // Thiếu "Bearer "

      expect(res.status).toBe(401);
    });
  });
});
