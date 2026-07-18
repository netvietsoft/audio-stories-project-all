import { UnauthorizedException } from '@nestjs/common';
import { OAuthService, GoogleUserData } from './oauth.service';

/** Prisma/UserClaims mock tối thiểu cho upsertGoogleUser — không DB thật. */
function makeMocks(existingUser: any) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(existingUser),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-1', ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...existingUser, ...data })),
    },
    role: { upsert: jest.fn().mockResolvedValue({ id: 4 }) },
    oAuthAccount: {
      findUnique: jest.fn().mockResolvedValue({ id: 'oa-1' }), // đã link — bỏ nhánh create
      create: jest.fn(),
    },
  };
  const claims = { assignDefaultRole: jest.fn() };
  return { prisma, claims, svc: new OAuthService(prisma as any, claims as any) };
}

const google = (over: Partial<GoogleUserData> = {}): GoogleUserData => ({
  provider: 'google',
  provider_user_id: 'g-1',
  email: 'a@b.c',
  name: 'A',
  avatar_url: null,
  raw: { email_verified: true },
  ...over,
});

describe('OAuthService.upsertGoogleUser — gate email_verified + chống pre-hijack', () => {
  it('email_verified false → UnauthorizedException (không đụng DB)', async () => {
    const { svc, prisma } = makeMocks(null);
    await expect(svc.upsertGoogleUser(google({ raw: { email_verified: false } }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('raw thiếu email_verified → UnauthorizedException', async () => {
    const { svc } = makeMocks(null);
    await expect(svc.upsertGoogleUser(google({ raw: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('account cũ CHƯA verify + có passwordHash → auto-verify VÀ vô hiệu password cũ', async () => {
    const existing = {
      id: 'u-1',
      email: 'a@b.c',
      emailVerifiedAt: null,
      passwordHash: 'hash-cua-ke-dang-ky-truoc',
      displayName: 'X',
      avatarUrl: 'x',
      googleId: 'g-1',
      country: 'VN',
    };
    const { svc, prisma } = makeMocks(existing);
    await svc.upsertGoogleUser(google());
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(data.passwordHash).toBeNull();
  });

  it('account cũ ĐÃ verify → passwordHash giữ nguyên (không có trong update)', async () => {
    const existing = {
      id: 'u-2',
      email: 'a@b.c',
      emailVerifiedAt: new Date('2026-01-01'),
      passwordHash: 'hash-hop-le',
      displayName: '',
      avatarUrl: null,
      googleId: null,
      country: null,
    };
    const { svc, prisma } = makeMocks(existing);
    await svc.upsertGoogleUser(google());
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('passwordHash');
    expect(data).not.toHaveProperty('emailVerifiedAt');
  });

  it('user mới + email_verified true → tạo bình thường', async () => {
    const { svc, prisma, claims } = makeMocks(null);
    const u = await svc.upsertGoogleUser(google());
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(claims.assignDefaultRole).toHaveBeenCalledWith(u.id);
  });
});
