import {
  checkChapterEntitlement,
  checkVariantEntitlement,
  checkMusicEntitlement,
} from '../hls-entitlement';
import type { PrismaService } from '@/prisma/prisma.service';

// Build a Prisma mock from a per-model fixture map. Each model method is a
// jest.fn resolving to the configured value (default null/[]).
function mockPrisma(overrides: Record<string, any> = {}): PrismaService {
  const def = {
    chapter: { findUnique: async () => null },
    chapterVariant: { findFirst: async () => null },
    music: { findUnique: async () => null, findMany: async () => [] },
    user: { findUnique: async () => null },
    userStoryUnlock: { findUnique: async () => null },
    userUnlockedVariant: {
      findUnique: async () => null,
      findFirst: async () => null,
    },
    musicUnlock: { findUnique: async () => null, findFirst: async () => null },
  };
  // Shallow-merge per model
  const merged: any = {};
  for (const key of new Set([...Object.keys(def), ...Object.keys(overrides)])) {
    merged[key] = { ...(def as any)[key], ...(overrides as any)[key] };
  }
  return merged as PrismaService;
}

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);
const activeVip = { vipTier: 1, vipExpirationDate: future };

describe('checkChapterEntitlement', () => {
  it('free chapter → anonymous allowed', async () => {
    const p = mockPrisma({
      chapter: { findUnique: async () => ({ accessType: 'free' }) },
    });
    expect(await checkChapterEntitlement(p, 'c1')).toBe(true);
  });

  it('timed chapter past unlocksAt → anonymous allowed', async () => {
    const p = mockPrisma({
      chapter: {
        findUnique: async () => ({ accessType: 'timed', unlocksAt: past }),
      },
    });
    expect(await checkChapterEntitlement(p, 'c1')).toBe(true);
  });

  it('vip chapter, no user → denied', async () => {
    const p = mockPrisma({
      chapter: { findUnique: async () => ({ accessType: 'vip' }) },
    });
    expect(await checkChapterEntitlement(p, 'c1')).toBe(false);
  });

  it('vip chapter, active VIP user → allowed', async () => {
    const p = mockPrisma({
      chapter: {
        findUnique: async () => ({ accessType: 'vip', storyId: 's1' }),
      },
      user: { findUnique: async () => activeVip },
    });
    expect(await checkChapterEntitlement(p, 'c1', 'u1')).toBe(true);
  });

  it('vip chapter, non-VIP but story unlocked → allowed', async () => {
    const p = mockPrisma({
      chapter: {
        findUnique: async () => ({ accessType: 'vip', storyId: 's1' }),
      },
      user: { findUnique: async () => ({ vipTier: 0 }) },
      userStoryUnlock: { findUnique: async () => ({ storyId: 's1' }) },
    });
    expect(await checkChapterEntitlement(p, 'c1', 'u1')).toBe(true);
  });

  it('vip chapter, non-VIP, no story unlock → denied', async () => {
    const p = mockPrisma({
      chapter: {
        findUnique: async () => ({ accessType: 'vip', storyId: 's1' }),
      },
      user: { findUnique: async () => ({ vipTier: 0 }) },
    });
    expect(await checkChapterEntitlement(p, 'c1', 'u1')).toBe(false);
  });

  it('priced chapter (ads), no variant: allowed only with an unlocked variant of the chapter', async () => {
    const denied = mockPrisma({
      chapter: {
        findUnique: async () => ({ accessType: 'ads', unlockPrice: 50 }),
      },
      user: { findUnique: async () => ({ vipTier: 0 }) },
    });
    expect(await checkChapterEntitlement(denied, 'c1', 'u1')).toBe(false);

    const allowed = mockPrisma({
      chapter: {
        findUnique: async () => ({ accessType: 'ads', unlockPrice: 50 }),
      },
      user: { findUnique: async () => ({ vipTier: 0 }) },
      userUnlockedVariant: { findFirst: async () => ({ userId: 'u1' }) },
    });
    expect(await checkChapterEntitlement(allowed, 'c1', 'u1')).toBe(true);
  });

  it('missing chapter → denied', async () => {
    expect(await checkChapterEntitlement(mockPrisma(), 'nope')).toBe(false);
  });
});

describe('checkVariantEntitlement (per-variant isolation, C4)', () => {
  it('unlocking variant A authorizes A but NOT variant B', async () => {
    // Variant A: an unlock row exists for exactly (u1, vA).
    const pA = mockPrisma({
      chapterVariant: { findFirst: async () => ({ chapterId: 'c1' }) },
      chapter: {
        findUnique: async () => ({ accessType: 'ads', unlockPrice: 50 }),
      },
      user: { findUnique: async () => ({ vipTier: 0 }) },
      userUnlockedVariant: {
        findUnique: async ({ where }: any) =>
          where.userId_variantId.variantId === 'vA' ? { userId: 'u1' } : null,
      },
    });
    expect(await checkVariantEntitlement(pA, 'vA', 'u1')).toBe(true);
    expect(await checkVariantEntitlement(pA, 'vB', 'u1')).toBe(false);
  });

  it('missing/deleted variant → denied', async () => {
    expect(await checkVariantEntitlement(mockPrisma(), 'gone', 'u1')).toBe(
      false,
    );
  });

  it('free parent chapter → variant allowed for anonymous', async () => {
    const p = mockPrisma({
      chapterVariant: { findFirst: async () => ({ chapterId: 'c1' }) },
      chapter: { findUnique: async () => ({ accessType: 'free' }) },
    });
    expect(await checkVariantEntitlement(p, 'vA')).toBe(true);
  });
});

describe('checkMusicEntitlement (no VIP tier, H3)', () => {
  it('free music → anonymous allowed', async () => {
    const p = mockPrisma({
      music: {
        findUnique: async () => ({
          id: 'm1',
          accessType: 'free',
          unlockPrice: 0,
          isPublic: true,
        }),
      },
    });
    expect(await checkMusicEntitlement(p, 'm1')).toBe(true);
  });

  it('paid music, no user → denied', async () => {
    const p = mockPrisma({
      music: {
        findUnique: async () => ({
          id: 'm1',
          accessType: 'vip',
          unlockPrice: 100,
          isPublic: true,
        }),
        findMany: async () => [],
      },
    });
    expect(await checkMusicEntitlement(p, 'm1')).toBe(false);
  });

  it('paid music, direct MusicUnlock → allowed', async () => {
    const p = mockPrisma({
      music: {
        findUnique: async () => ({
          id: 'm1',
          accessType: 'vip',
          unlockPrice: 100,
          isPublic: true,
        }),
        findMany: async () => [],
      },
      musicUnlock: { findUnique: async () => ({ id: 'mu1' }) },
    });
    expect(await checkMusicEntitlement(p, 'm1', 'u1')).toBe(true);
  });

  it('paid music does NOT unlock via VIP tier (H3)', async () => {
    const p = mockPrisma({
      music: {
        findUnique: async () => ({
          id: 'm1',
          accessType: 'vip',
          unlockPrice: 100,
          isPublic: true,
        }),
        findMany: async () => [],
      },
      // even if a user row exists with high vipTier, music stays locked
      user: { findUnique: async () => activeVip },
    });
    expect(await checkMusicEntitlement(p, 'm1', 'u1')).toBe(false);
  });

  it('non-public music → denied', async () => {
    const p = mockPrisma({
      music: {
        findUnique: async () => ({
          id: 'm1',
          accessType: 'free',
          unlockPrice: 0,
          isPublic: false,
        }),
      },
    });
    expect(await checkMusicEntitlement(p, 'm1')).toBe(false);
  });
});
