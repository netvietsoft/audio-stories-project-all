/**
 * chapter-unlock-tracking.e2e-spec.ts
 *
 * Kiểm tra toàn bộ luồng UserChapterUnlock Ledger:
 *
 * Luồng 1 – VIP Chapter (fire-and-forget tracking):
 *   ✅ VIP user nghe chương VIP → UserChapterUnlock được ghi (unlockType=VIP, pulseAmount=0)
 *   ✅ Nghe lần 2 → idempotent, không ghi thêm record
 *   ❌ Non-VIP user nghe chương VIP → 403
 *
 * Luồng 2 – TIMED Chapter (fire-and-forget tracking):
 *   ✅ VIP user nghe chương TIMED → UserChapterUnlock được ghi (unlockType=TIMED, pulseAmount=0)
 *   ✅ Chương TIMED đã qua unlock date → tất cả user đều xem được (anonymous)
 *
 * Luồng 3 – PULSE Unlock (atomic transaction):
 *   ✅ Unlock variant bằng Pulse → UserChapterUnlock ghi đúng pulseAmount trong cùng transaction
 *   ✅ ATOMICITY: pulseBalance, UserUnlockedVariant, CreditTransaction, UserChapterUnlock đều nhất quán
 *
 * Luồng 4 – Stats API:
 *   ✅ GET /stats/vip-chapters → vipOpenCount, timedOpenCount đếm từ bảng UserChapterUnlock
 *   ✅ totalCredits = SUM(pulseAmount) thực thu (Phương án A), không phải viewCount
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { createTestApp, getPrisma } from './test-app.factory';

const VIP_USER_EMAIL    = 'e2e-vip@test.local';
const VIP_USER_PASSWORD = 'User@1234Test';
const RICH_USER_EMAIL   = 'e2e-rich@test.local';
const RICH_USER_PASSWORD = 'User@1234Test';
const ADMIN_EMAIL       = 'e2e-admin@test.local';
const ADMIN_PASSWORD    = 'Admin@1234Test';

const VIP_CHAPTER_ID   = 'e2e-vip-chapter-id-000002';
const TIMED_CHAPTER_ID = 'e2e-timed-chapter-id-000003';
const TIMED_CHAPTER_FUTURE_ID = 'e2e-timed-chapter-future-id-000004';
const PAID_VARIANT_ID  = 'e2e-paid-variant-id-0001';

/** Đợi một khoảng ngắn để fire-and-forget setImmediate được execute */
const waitForTracking = () => new Promise((resolve) => setTimeout(resolve, 200));

describe('UserChapterUnlock Ledger – Tracking & Stats (E2E)', () => {
  let app: INestApplication;
  let vipToken: string;
  let richUserToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const prisma = getPrisma(app);

    // Login VIP user
    const vipRes = await supertest(app.getHttpServer())
      .post('/auth/login')
      .send({ email: VIP_USER_EMAIL, password: VIP_USER_PASSWORD });
    vipToken = vipRes.body.access_token;

    // Login rich user (non-VIP, có Pulse)
    const richRes = await supertest(app.getHttpServer())
      .post('/auth/login')
      .send({ email: RICH_USER_EMAIL, password: RICH_USER_PASSWORD });
    richUserToken = richRes.body.access_token;

    // Login admin
    const adminRes = await supertest(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = adminRes.body.access_token;

    expect(vipToken).toBeDefined();
    expect(richUserToken).toBeDefined();
    expect(adminToken).toBeDefined();

    // Reset: xóa tất cả UserChapterUnlock cũ của test users
    const vipUser  = await prisma.user.findUnique({ where: { email: VIP_USER_EMAIL } });
    const richUser = await prisma.user.findUnique({ where: { email: RICH_USER_EMAIL } });

    await prisma.userChapterUnlock.deleteMany({
      where: {
        userId: { in: [vipUser!.id, richUser!.id] },
        chapterId: { in: [VIP_CHAPTER_ID, TIMED_CHAPTER_ID, TIMED_CHAPTER_FUTURE_ID] },
      },
    });

    // Đảm bảo rich user chưa unlock paid variant
    await prisma.userUnlockedVariant.deleteMany({
      where: { userId: richUser!.id, variantId: PAID_VARIANT_ID },
    });
    // Reset pulse
    await prisma.user.update({
      where: { id: richUser!.id },
      data: { pulseBalance: 5000 },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Luồng 1: VIP Chapter ──────────────────────────────────────────────────

  describe('Luồng 1 – VIP Chapter (GET /chapters/:id/audio)', () => {
    beforeEach(async () => {
      // Xóa tracking record trước mỗi test để state sạch
      const prisma = getPrisma(app);
      const vipUser = await prisma.user.findUnique({ where: { email: VIP_USER_EMAIL } });
      await prisma.userChapterUnlock.deleteMany({
        where: { userId: vipUser!.id, chapterId: VIP_CHAPTER_ID },
      });
    });

    it('✅ VIP user nghe chương VIP → 200 OK', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/chapters/${VIP_CHAPTER_ID}/audio`)
        .set('Authorization', `Bearer ${vipToken}`);

      // Phải trả về URL (có thể là redirect 302 hoặc 200 với url field)
      expect([200, 302]).toContain(res.status);
    });

    it('✅ VIP user nghe chương VIP → UserChapterUnlock được tạo (unlockType=VIP, pulseAmount=0)', async () => {
      const prisma = getPrisma(app);
      const vipUser = await prisma.user.findUnique({ where: { email: VIP_USER_EMAIL } });

      // Gọi API
      await supertest(app.getHttpServer())
        .get(`/chapters/${VIP_CHAPTER_ID}/audio`)
        .set('Authorization', `Bearer ${vipToken}`);

      // Đợi fire-and-forget hoàn thành
      await waitForTracking();

      const record = await prisma.userChapterUnlock.findUnique({
        where: { userId_chapterId: { userId: vipUser!.id, chapterId: VIP_CHAPTER_ID } },
      });

      expect(record).not.toBeNull();
      expect(record!.unlockType).toBe('VIP');
      expect(record!.pulseAmount).toBe(0);
    });

    it('✅ IDEMPOTENCY: Nghe lần 2 → không tạo thêm record', async () => {
      const prisma = getPrisma(app);
      const vipUser = await prisma.user.findUnique({ where: { email: VIP_USER_EMAIL } });

      // Lần 1
      await supertest(app.getHttpServer())
        .get(`/chapters/${VIP_CHAPTER_ID}/audio`)
        .set('Authorization', `Bearer ${vipToken}`);
      await waitForTracking();

      // Lần 2
      await supertest(app.getHttpServer())
        .get(`/chapters/${VIP_CHAPTER_ID}/audio`)
        .set('Authorization', `Bearer ${vipToken}`);
      await waitForTracking();

      const count = await prisma.userChapterUnlock.count({
        where: { userId: vipUser!.id, chapterId: VIP_CHAPTER_ID },
      });

      // Unique constraint đảm bảo chỉ có 1 record
      expect(count).toBe(1);
    });

    it('❌ Non-VIP user nghe chương VIP → 403 Forbidden', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/chapters/${VIP_CHAPTER_ID}/audio`)
        .set('Authorization', `Bearer ${richUserToken}`);

      expect(res.status).toBe(403);
    });

    it('❌ Anonymous user nghe chương VIP → 403 Forbidden', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/chapters/${VIP_CHAPTER_ID}/audio`);

      expect(res.status).toBe(403);
    });
  });

  // ─── Luồng 2: TIMED Chapter ────────────────────────────────────────────────

  describe('Luồng 2 – TIMED Chapter (GET /chapters/:id/audio)', () => {
    beforeEach(async () => {
      const prisma = getPrisma(app);
      const vipUser = await prisma.user.findUnique({ where: { email: VIP_USER_EMAIL } });
      await prisma.userChapterUnlock.deleteMany({
        where: { userId: vipUser!.id, chapterId: { in: [TIMED_CHAPTER_ID, TIMED_CHAPTER_FUTURE_ID] } },
      });
    });

    it('✅ Chương TIMED đã qua unlocksAt → tất cả user đều truy cập được (anonymous)', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/chapters/${TIMED_CHAPTER_ID}/audio`);

      // unlocksAt đã qua → free access, không cần auth
      expect([200, 302]).toContain(res.status);
    });

    it('✅ VIP user nghe chương TIMED tương lai → UserChapterUnlock được tạo (unlockType=TIMED, pulseAmount=0)', async () => {
      const prisma = getPrisma(app);
      const vipUser = await prisma.user.findUnique({ where: { email: VIP_USER_EMAIL } });

      await supertest(app.getHttpServer())
        .get(`/chapters/${TIMED_CHAPTER_FUTURE_ID}/audio`)
        .set('Authorization', `Bearer ${vipToken}`);

      await waitForTracking();

      const record = await prisma.userChapterUnlock.findUnique({
        where: { userId_chapterId: { userId: vipUser!.id, chapterId: TIMED_CHAPTER_FUTURE_ID } },
      });

      expect(record).not.toBeNull();
      expect(record!.unlockType).toBe('TIMED');
      expect(record!.pulseAmount).toBe(0);
    });
  });

  // ─── Luồng 3: PULSE Unlock (atomic transaction) ────────────────────────────

  describe('Luồng 3 – Paid Variant Unlock (POST /chapter-variants/:id/unlock)', () => {
    let richUserId: string;
    const VARIANT_PRICE = 100;

    beforeEach(async () => {
      const prisma = getPrisma(app);
      const richUser = await prisma.user.findUnique({ where: { email: RICH_USER_EMAIL } });
      richUserId = richUser!.id;

      // Reset state
      await prisma.userUnlockedVariant.deleteMany({
        where: { userId: richUserId, variantId: PAID_VARIANT_ID },
      });
      await prisma.userChapterUnlock.deleteMany({
        where: { userId: richUserId },
      });
      await prisma.user.update({
        where: { id: richUserId },
        data: { pulseBalance: 5000 },
      });
    });

    it('✅ ATOMICITY: Unlock variant → 4 bảng nhất quán (pulse, UserUnlockedVariant, CreditTransaction, UserChapterUnlock)', async () => {
      const prisma = getPrisma(app);
      const pulseBefore = 5000;

      const res = await supertest(app.getHttpServer())
        .post(`/chapter-variants/${PAID_VARIANT_ID}/unlock`)
        .set('Authorization', `Bearer ${richUserToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.balance).toBe(pulseBefore - VARIANT_PRICE);

      // ── 1. pulseBalance bị trừ đúng ───────────────────────────────────────
      const updatedUser = await prisma.user.findUnique({ where: { id: richUserId } });
      expect(updatedUser!.pulseBalance).toBe(pulseBefore - VARIANT_PRICE);

      // ── 2. UserUnlockedVariant tồn tại ────────────────────────────────────
      const variantUnlock = await prisma.userUnlockedVariant.findUnique({
        where: { userId_variantId: { userId: richUserId, variantId: PAID_VARIANT_ID } },
      });
      expect(variantUnlock).not.toBeNull();

      // ── 3. CreditTransaction tồn tại với đúng số tiền ──────────────────
      const txRecord = await prisma.creditTransaction.findFirst({
        where: { userId: richUserId, referenceId: PAID_VARIANT_ID, type: 'spend' },
        orderBy: { createdAt: 'desc' },
      });
      expect(txRecord).not.toBeNull();
      expect(txRecord!.pulseAmount).toBe(-VARIANT_PRICE);
      expect(txRecord!.pulseBalanceBefore).toBe(pulseBefore);
      expect(txRecord!.pulseBalanceAfter).toBe(pulseBefore - VARIANT_PRICE);

      // ── 4. UserChapterUnlock ghi đúng pulseAmount (SỔ CÁI THỰC TẾ) ───
      // Tìm chapterId của paid variant
      const variant = await prisma.chapterVariant.findUnique({
        where: { id: PAID_VARIANT_ID },
        select: { chapterId: true },
      });

      const unlockRecord = await prisma.userChapterUnlock.findUnique({
        where: { userId_chapterId: { userId: richUserId, chapterId: variant!.chapterId } },
      });
      expect(unlockRecord).not.toBeNull();
      expect(unlockRecord!.unlockType).toBe('PULSE');
      expect(unlockRecord!.pulseAmount).toBe(VARIANT_PRICE); // Phương án A: Pulse thực thu
    });

    it('✅ IDEMPOTENCY: Unlock lần 2 → không trừ Pulse, UserChapterUnlock vẫn chỉ 1 record', async () => {
      const prisma = getPrisma(app);

      // Lần 1
      await supertest(app.getHttpServer())
        .post(`/chapter-variants/${PAID_VARIANT_ID}/unlock`)
        .set('Authorization', `Bearer ${richUserToken}`);

      const pulseAfterFirst = (await prisma.user.findUnique({ where: { id: richUserId } }))!.pulseBalance;

      // Lần 2
      const res2 = await supertest(app.getHttpServer())
        .post(`/chapter-variants/${PAID_VARIANT_ID}/unlock`)
        .set('Authorization', `Bearer ${richUserToken}`);

      expect(res2.status).toBe(201);

      // Pulse không bị trừ thêm
      const pulseAfterSecond = (await prisma.user.findUnique({ where: { id: richUserId } }))!.pulseBalance;
      expect(pulseAfterSecond).toBe(pulseAfterFirst);

      // Vẫn chỉ có 1 UserChapterUnlock record
      const variant = await prisma.chapterVariant.findUnique({
        where: { id: PAID_VARIANT_ID },
        select: { chapterId: true },
      });
      const unlockCount = await prisma.userChapterUnlock.count({
        where: { userId: richUserId, chapterId: variant!.chapterId },
      });
      expect(unlockCount).toBe(1);
    });
  });

  // ─── Luồng 4: Stats API ────────────────────────────────────────────────────

  describe('Luồng 4 – Stats API GET /stats/vip-chapters', () => {
    it('✅ API trả về 200 và có đủ các fields bắt buộc', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/stats/vip-chapters')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('totalStories');
      expect(res.body.summary).toHaveProperty('totalVipOpens');
      expect(res.body.summary).toHaveProperty('totalTimedOpens');
      expect(res.body.summary).toHaveProperty('totalCredits');
    });

    it('✅ Tất cả numeric fields là số (không có undefined làm crash .toLocaleString)', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/stats/vip-chapters')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      for (const story of res.body.data) {
        expect(typeof story.vipOpenCount).toBe('number');
        expect(typeof story.timedOpenCount).toBe('number');
        expect(typeof story.totalOpenCount).toBe('number');
        expect(typeof story.totalCredits).toBe('number');
        expect(typeof story.vipChapterCount).toBe('number');
        expect(typeof story.timedChapterCount).toBe('number');
      }
    });

    it('✅ totalCredits phản ánh Pulse thực thu (0 vì chưa có giao dịch Pulse trên VIP chapters)', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/stats/vip-chapters')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Vì test chapter VIP có unlockPrice=0 và chỉ có VIP user (pulseAmount=0) nghe
      // → tổng Pulse thực thu trên VIP/TIMED chapters = 0
      const story = res.body.data.find(
        (s: any) => s.chapters?.some((c: any) => c.id === VIP_CHAPTER_ID || c.id === TIMED_CHAPTER_ID || c.id === TIMED_CHAPTER_FUTURE_ID),
      );
      if (story) {
        expect(story.totalCredits).toBe(0); // Chính xác: không có Pulse thực thu
      }
    });

    it('❌ Non-admin không được phép truy cập → 401 hoặc 403', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/stats/vip-chapters')
        .set('Authorization', `Bearer ${richUserToken}`);

      expect([401, 403]).toContain(res.status);
    });

    it('❌ Anonymous → 401', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/stats/vip-chapters');

      expect(res.status).toBe(401);
    });
  });
});
