import type { PrismaService } from '@/prisma/prisma.service';

/**
 * Read-only entitlement checks for HLS key access.
 *
 * These MIRROR the existing playback rules but perform NO writes — unlike
 * `ChaptersService.getAudioUrl`, which fires `setImmediate(...userChapterUnlock
 * .upsert)` side effects (red-team C2). hls.js fetches the key on every play,
 * so the gate must be side-effect-free or it would record bogus unlocks/billing.
 */

async function isActiveVip(
  prisma: PrismaService,
  userId: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { vipTier: true, vipExpirationDate: true },
  });
  return (
    !!user &&
    (user.vipTier ?? 0) > 0 &&
    (!user.vipExpirationDate || user.vipExpirationDate > new Date())
  );
}

function parsePlaylistTrackIds(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === 'string')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Chapter-level audio entitlement. When `variantId` is given, the priced branch
 * authorizes ONLY that variant (no "any variant of the chapter" fallback) so
 * unlocking one variant never opens another (red-team C4).
 */
export async function checkChapterEntitlement(
  prisma: PrismaService,
  chapterId: string,
  userId?: string,
  variantId?: string,
): Promise<boolean> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      accessType: true,
      unlockPrice: true,
      unlocksAt: true,
      storyId: true,
    },
  });
  if (!chapter) return false;

  if (chapter.accessType === 'free') return true;
  if (
    chapter.accessType === 'timed' &&
    chapter.unlocksAt &&
    chapter.unlocksAt <= new Date()
  ) {
    return true;
  }
  if (!userId) return false;

  if (await isActiveVip(prisma, userId)) return true;

  if (chapter.accessType === 'vip' || chapter.accessType === 'timed') {
    if (!chapter.storyId) return false;
    const storyUnlock = await prisma.userStoryUnlock.findUnique({
      where: { userId_storyId: { userId, storyId: chapter.storyId } },
      select: { storyId: true },
    });
    return !!storyUnlock;
  }

  // Priced (e.g. accessType 'ads' with unlockPrice). Mirror getAudioUrl's
  // required-price gate but variant-scoped when a variant is named.
  let variantUnlockPrice = 0;
  if (variantId) {
    const variant = await prisma.chapterVariant.findFirst({
      where: { id: variantId, chapterId, deletedAt: null },
      select: { unlockPrice: true },
    });
    if (!variant) return false;
    variantUnlockPrice = variant.unlockPrice || 0;
  }

  const required = Math.max(chapter.unlockPrice || 0, variantUnlockPrice);
  if (required <= 0) return true;

  if (variantId) {
    const unlocked = await prisma.userUnlockedVariant.findUnique({
      where: { userId_variantId: { userId, variantId } },
    });
    return !!unlocked;
  }
  const unlocked = await prisma.userUnlockedVariant.findFirst({
    where: { userId, variant: { chapterId } },
  });
  return !!unlocked;
}

/** Per-variant audio entitlement — each variant is its own HLS asset (C4). */
export async function checkVariantEntitlement(
  prisma: PrismaService,
  variantId: string,
  userId?: string,
): Promise<boolean> {
  const variant = await prisma.chapterVariant.findFirst({
    where: { id: variantId, deletedAt: null },
    select: { chapterId: true },
  });
  if (!variant) return false;
  return checkChapterEntitlement(prisma, variant.chapterId, userId, variantId);
}

/**
 * Music (single-track) entitlement. Music does NOT use VIP tier (red-team H3):
 * access is free/zero-price, a direct MusicUnlock, or a playlist unlock that
 * covers this track.
 */
export async function checkMusicEntitlement(
  prisma: PrismaService,
  musicId: string,
  userId?: string,
): Promise<boolean> {
  const music = await prisma.music.findUnique({
    where: { id: musicId },
    select: { id: true, accessType: true, unlockPrice: true, isPublic: true },
  });
  if (!music || !music.isPublic) return false;
  if (music.accessType === 'free' || music.unlockPrice <= 0) return true;
  if (!userId) return false;

  const direct = await prisma.musicUnlock.findUnique({
    where: { userId_musicId: { userId, musicId } },
    select: { id: true },
  });
  if (direct) return true;

  // A track is also unlocked if the user owns a playlist that contains it.
  const playlists = await prisma.music.findMany({
    where: { contentType: 'playlist' },
    select: { id: true, playlistTrackIds: true },
  });
  const matching = playlists
    .filter((p) => parsePlaylistTrackIds(p.playlistTrackIds).includes(musicId))
    .map((p) => p.id);
  if (matching.length) {
    const playlistUnlock = await prisma.musicUnlock.findFirst({
      where: {
        userId,
        sourceType: 'playlist',
        sourcePlaylistId: { in: matching },
      },
      select: { id: true },
    });
    if (playlistUnlock) return true;
  }
  return false;
}
