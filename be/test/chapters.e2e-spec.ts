/**
 * chapters.e2e-spec.ts – Test Redaction, Business Logic Pulse & Giao dịch
 *
 * Bao phủ:
 * ✅ REDACTION: GET /chapters/:id/variants khi CHƯA MUA paid variant
 *    → content, audioUrl, r2AudioUrl phải là null
 * ✅ REDACTION: GET /chapters/:id/variants khi ĐÃ MUA → trả về full data
 * ✅ REDACTION: Free variant luôn trả về full data (không cần mua)
 * ✅ PULSE: POST /chapter-variants/:id/unlock với pulseBalance KHÔNG ĐỦ → 400
 * ✅ PULSE: POST /chapter-variants/:id/unlock với pulseBalance ĐỦ → 200
 *    → Kiểm tra DB: pulse bị trừ đúng, transaction record tồn tại
 * ✅ ATOMICITY: Nếu unlock thành công, cả 3 bảng (user.pulseBalance,
 *    UserUnlockedVariant, CreditTransaction) phải được update trong 1 transaction
 * ✅ IDEMPOTENCY: Unlock variant đã mua → trả về success (không trừ tiền lần 2)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { createTestApp, getPrisma } from './test-app.factory';

const USER_EMAIL = 'e2e-user@test.local';
const USER_PASSWORD = 'User@1234Test';
const RICH_USER_EMAIL = 'e2e-rich@test.local';
const RICH_USER_PASSWORD = 'User@1234Test';

const FREE_VARIANT_ID = 'e2e-free-variant-id-0000';
const PAID_VARIANT_ID = 'e2e-paid-variant-id-0001';

describe('Chapters & Variants (E2E)', () => {
  let app: INestApplication;
  let userToken: string;
  let richUserToken: string;
  let chapterId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Lấy chapter thực từ DB
    const prisma = getPrisma(app);
    const chapter = await prisma.chapter.findFirst({
      where: { title: 'Chapter 1 - E2E Test' },
    });
    chapterId = chapter!.id;

    // Đăng nhập và lấy tokens
    const userRes = await supertest(app.getHttpServer())
      .post('/auth/login')
      .send({ email: USER_EMAIL, password: USER_PASSWORD });
    userToken = userRes.body.access_token;

    const richRes = await supertest(app.getHttpServer())
      .post('/auth/login')
      .send({ email: RICH_USER_EMAIL, password: RICH_USER_PASSWORD });
    richUserToken = richRes.body.access_token;

    expect(chapterId).toBeDefined();
    expect(userToken).toBeDefined();
    expect(richUserToken).toBeDefined();

    // Reset rich user pulse về 5000 trước mỗi suite
    const richUser = await prisma.user.findUnique({
      where: { email: RICH_USER_EMAIL },
    });
    await prisma.user.update({
      where: { id: richUser!.id },
      data: { pulseBalance: 5000 },
    });

    // Xóa các unlock cũ nếu có
    await prisma.userUnlockedVariant.deleteMany({
      where: {
        userId: richUser!.id,
        variantId: PAID_VARIANT_ID,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Luồng Redaction ─────────────────────────────────────────────────────

  describe('Content Redaction – GET /chapters/:id/variants', () => {
    it('✅ Anonymous: Free variant → full content trả về', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/chapters/${chapterId}/variants`);

      expect(res.status).toBe(200);
      const freeVariant = res.body.find((v: any) => v.id === FREE_VARIANT_ID);
      expect(freeVariant).toBeDefined();
      // Free variant không bị redact
      expect(freeVariant.content).not.toBeNull();
    });

    it('✅ Anonymous: Paid variant → content, audioUrl, r2AudioUrl phải là NULL (Redacted)', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/chapters/${chapterId}/variants`);

      expect(res.status).toBe(200);
      const paidVariant = res.body.find((v: any) => v.id === PAID_VARIANT_ID);
      expect(paidVariant).toBeDefined();

      // BẮT BUỘC: Các field nhạy cảm phải bị null khi chưa mua
      expect(paidVariant.content).toBeNull();
      expect(paidVariant.audioUrl).toBeNull();
      expect(paidVariant.r2AudioUrl).toBeNull();
    });

    it('✅ User chưa mua: Paid variant → content, audioUrl, r2AudioUrl là NULL', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/chapters/${chapterId}/variants`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      const paidVariant = res.body.find((v: any) => v.id === PAID_VARIANT_ID);
      expect(paidVariant).toBeDefined();

      expect(paidVariant.content).toBeNull();
      expect(paidVariant.audioUrl).toBeNull();
      expect(paidVariant.r2AudioUrl).toBeNull();
    });

    it('✅ Rich user sau khi mua: Paid variant → full content', async () => {
      // Mua variant trước
      await supertest(app.getHttpServer())
        .post(`/chapter-variants/${PAID_VARIANT_ID}/unlock`)
        .set('Authorization', `Bearer ${richUserToken}`);

      // Gọi lại API variants
      const res = await supertest(app.getHttpServer())
        .get(`/chapters/${chapterId}/variants`)
        .set('Authorization', `Bearer ${richUserToken}`);

      expect(res.status).toBe(200);
      const paidVariant = res.body.find((v: any) => v.id === PAID_VARIANT_ID);
      expect(paidVariant).toBeDefined();

      // BẮT BUỘC: Sau khi mua, phải trả về full data
      expect(paidVariant.content).toBe('Paid content here - should be redacted');
      expect(paidVariant.audioUrl).not.toBeNull();
      expect(paidVariant.r2AudioUrl).not.toBeNull();
    });
  });

  // ─── Luồng Pulse & Giao dịch ─────────────────────────────────────────────

  describe('Pulse Business Logic – POST /chapter-variants/:id/unlock', () => {
    beforeEach(async () => {
      // Reset để mỗi test có trạng thái rõ ràng
      const prisma = getPrisma(app);
      const poorUser = await prisma.user.findUnique({ where: { email: USER_EMAIL } });

      // User nghèo: pulseBalance = 0
      await prisma.user.update({
        where: { id: poorUser!.id },
        data: { pulseBalance: 0 },
      });
      // Xóa unlock record cũ nếu có
      await prisma.userUnlockedVariant.deleteMany({
        where: { userId: poorUser!.id, variantId: PAID_VARIANT_ID },
      });
    });

    it('❌ User không đủ Pulse → 400 Bad Request (Insufficient Pulse)', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/chapter-variants/${PAID_VARIANT_ID}/unlock`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      // Optional: kiểm tra message
      expect(res.body.message).toContain('Insufficient Pulse');
    });

    it('❌ Không có token → 401 Unauthorized', async () => {
      const res = await supertest(app.getHttpServer())
        .post(`/chapter-variants/${PAID_VARIANT_ID}/unlock`);

      expect(res.status).toBe(401);
    });

    it('❌ Variant ID không tồn tại → 404 Not Found', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/chapter-variants/non-existent-uuid-here/unlock')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });

    it('✅ User có đủ Pulse → 200 OK + pulse bị trừ', async () => {
      const prisma = getPrisma(app);
      const richUser = await prisma.user.findUnique({ where: { email: RICH_USER_EMAIL } });

      // Đảm bảo rich user chưa unlock variant này
      await prisma.userUnlockedVariant.deleteMany({
        where: { userId: richUser!.id, variantId: PAID_VARIANT_ID },
      });
      // Reset pulse
      await prisma.user.update({
        where: { id: richUser!.id },
        data: { pulseBalance: 5000 },
      });

      const pulseBefore = 5000;
      const variantPrice = 100; // Seeded với unlockPrice: 100

      const res = await supertest(app.getHttpServer())
        .post(`/chapter-variants/${PAID_VARIANT_ID}/unlock`)
        .set('Authorization', `Bearer ${richUserToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.balance).toBe(pulseBefore - variantPrice);

      // ─── Kiểm tra DB để đảm bảo ATOMICITY ────────────────────────────
      const updatedUser = await prisma.user.findUnique({
        where: { id: richUser!.id },
      });
      // 1. pulseBalance bị trừ đúng
      expect(updatedUser!.pulseBalance).toBe(pulseBefore - variantPrice);

      // 2. UserUnlockedVariant record phải tồn tại
      const unlockRecord = await prisma.userUnlockedVariant.findUnique({
        where: { userId_variantId: { userId: richUser!.id, variantId: PAID_VARIANT_ID } },
      });
      expect(unlockRecord).not.toBeNull();

      // 3. CreditTransaction record phải tồn tại
      const txRecord = await prisma.creditTransaction.findFirst({
        where: {
          userId: richUser!.id,
          referenceId: PAID_VARIANT_ID,
          type: 'spend',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(txRecord).not.toBeNull();
      expect(txRecord!.pulseAmount).toBe(-variantPrice);
      expect(txRecord!.pulseBalanceBefore).toBe(pulseBefore);
      expect(txRecord!.pulseBalanceAfter).toBe(pulseBefore - variantPrice);
    });

    it('✅ IDEMPOTENCY: Unlock variant đã mua → không trừ tiền lần 2', async () => {
      const prisma = getPrisma(app);
      const richUser = await prisma.user.findUnique({ where: { email: RICH_USER_EMAIL } });

      // Reset để unlock variant
      await prisma.userUnlockedVariant.deleteMany({
        where: { userId: richUser!.id, variantId: PAID_VARIANT_ID },
      });
      await prisma.user.update({
        where: { id: richUser!.id },
        data: { pulseBalance: 5000 },
      });

      // Lần 1: unlock thành công
      await supertest(app.getHttpServer())
        .post(`/chapter-variants/${PAID_VARIANT_ID}/unlock`)
        .set('Authorization', `Bearer ${richUserToken}`);

      const pulseAfterFirst = (await prisma.user.findUnique({ where: { id: richUser!.id } }))!.pulseBalance;

      // Lần 2: unlock lại
      const res2 = await supertest(app.getHttpServer())
        .post(`/chapter-variants/${PAID_VARIANT_ID}/unlock`)
        .set('Authorization', `Bearer ${richUserToken}`);

      expect(res2.status).toBe(201);

      // Pulse không bị trừ thêm
      const pulseAfterSecond = (await prisma.user.findUnique({ where: { id: richUser!.id } }))!.pulseBalance;
      expect(pulseAfterSecond).toBe(pulseAfterFirst);
    });
  });

  // ─── Audio Proxy Endpoint ─────────────────────────────────────────────────

  describe('GET /chapters/:id/audio – Audio Proxy', () => {
    it('✅ Free chapter → không bị 401 (OptionalJwtGuard)', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/chapters/${chapterId}/audio`)
        .redirects(0); // Không follow redirect

      // Điều quan trọng là KHÔNG phải 401 (endpoint này dùng OptionalJwtGuard)
      expect(res.status).not.toBe(401);
    });
  });
});
