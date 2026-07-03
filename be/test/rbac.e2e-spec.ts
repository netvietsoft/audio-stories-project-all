/**
 * rbac.e2e-spec.ts – Test Role-Based Access Control
 *
 * Bao phủ:
 * ✅ User thường gọi API /auth/users (ADMIN only) → 403 Forbidden
 * ✅ User thường gọi API POST /stories/:storyId/chapters (ADMIN only) → 403
 * ✅ Admin gọi API POST /stories/:storyId/chapters → 201 hoặc 400 (NOT 401/403)
 * ✅ Không có token gọi API admin → 401 Unauthorized
 * ✅ Admin gọi POST /chapter-variants (tạo mới) → 201 Created
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { createTestApp, getPrisma } from './test-app.factory';

const ADMIN_EMAIL = 'e2e-admin@test.local';
const ADMIN_PASSWORD = 'Admin@1234Test';
const USER_EMAIL = 'e2e-user@test.local';
const USER_PASSWORD = 'User@1234Test';

describe('RBAC (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Đăng nhập và lấy token
    const adminRes = await supertest(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = adminRes.body.access_token;

    const userRes = await supertest(app.getHttpServer())
      .post('/auth/login')
      .send({ email: USER_EMAIL, password: USER_PASSWORD });
    userToken = userRes.body.access_token;

    expect(adminToken).toBeDefined();
    expect(userToken).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Test không có token ──────────────────────────────────────────────────

  describe('Không có token', () => {
    it('❌ GET /auth/users → 401 Unauthorized', async () => {
      const res = await supertest(app.getHttpServer()).get('/auth/users');
      expect(res.status).toBe(401);
    });

    it('❌ GET /auth/admin/stats → 401 Unauthorized', async () => {
      const res = await supertest(app.getHttpServer()).get('/auth/admin/stats');
      expect(res.status).toBe(401);
    });
  });

  // ─── Test với User token (role USER, không phải ADMIN) ───────────────────

  describe('User thường (role USER) gọi API ADMIN-only', () => {
    it('❌ GET /auth/users → 403 Forbidden', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/auth/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('❌ GET /auth/admin/stats → 403 Forbidden', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/auth/admin/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('❌ POST /stories/:storyId/chapters → 403 Forbidden', async () => {
      const prisma = getPrisma(app);
      const story = await prisma.story.findFirst({ where: { slug: 'e2e-test-story' } });

      const res = await supertest(app.getHttpServer())
        .post(`/stories/${story!.id}/chapters`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ chapterNumber: 999, title: 'Hacked Chapter' });

      expect(res.status).toBe(403);
    });

    it('❌ POST /chapter-variants → 403 Forbidden', async () => {
      const prisma = getPrisma(app);
      const chapter = await prisma.chapter.findFirst({
        where: { title: 'Chapter 1 - E2E Test' },
      });

      const res = await supertest(app.getHttpServer())
        .post('/chapter-variants')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          chapterId: chapter!.id,
          title: 'Unauthorized Variant',
          unlockPrice: 0,
        });

      expect(res.status).toBe(403);
    });
  });

  // ─── Test với Admin token ─────────────────────────────────────────────────

  describe('Admin gọi API ADMIN-only', () => {
    it('✅ GET /auth/users → 200', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/auth/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('✅ GET /auth/admin/stats → 200', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/auth/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalUsers');
    });

    it('✅ POST /stories/:storyId/chapters với admin → 201 Created', async () => {
      const prisma = getPrisma(app);
      const story = await prisma.story.findFirst({ where: { slug: 'e2e-test-story' } });

      const uniqueChapterNum = Math.floor(Math.random() * 900000) + 100000;

      const res = await supertest(app.getHttpServer())
        .post(`/stories/${story!.id}/chapters`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          chapterNumber: uniqueChapterNum,
          title: `Admin Created Chapter ${uniqueChapterNum}`,
          accessType: 'free',
          languageId: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');

      // Cleanup
      await prisma.chapter.delete({ where: { id: res.body.id } }).catch(() => {});
    });

    it('✅ POST /chapter-variants với admin → 201 Created', async () => {
      const prisma = getPrisma(app);
      const chapter = await prisma.chapter.findFirst({
        where: { title: 'Chapter 1 - E2E Test' },
      });

      const res = await supertest(app.getHttpServer())
        .post('/chapter-variants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          chapterId: chapter!.id,
          title: 'Admin Created Variant',
          unlockPrice: 0,
          orderIndex: 99,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');

      // Cleanup
      await prisma.chapterVariant.update({
        where: { id: res.body.id },
        data: { deletedAt: new Date() },
      }).catch(() => {});
    });
  });
});
