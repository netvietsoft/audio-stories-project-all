/**
 * Backfill `chapter_comments.paragraph_anchor` for existing paragraph-scope comments.
 *
 * WHY: paragraph comments used to be anchored purely by positional index (stored in
 * `timestamp_seconds`). The web reader now merges paragraphs to >=250 words, which
 * shifts those indices. We now also anchor by a normalized content snippet
 * (`paragraph_anchor`). This script reconstructs the OLD (pre-merge) paragraph blocks
 * for each chapter using the exact same regex logic the web used, then computes and
 * stores the anchor for the block at each comment's stored index.
 *
 * The old-split helpers (normalizeStoryContent / hasVisibleContent / block regex /
 * fallback split) are copied verbatim from the pre-port FE StoryReader
 * (git 299d1af:fe/apps/web/src/components/story/StoryReader.tsx). They are pure
 * string/regex operations with NO DOM dependency, so they run unchanged in Node.
 * (Invisible-char literals in the source — U+00A0, U+200B..U+200D, U+FEFF — are
 * written here as \u escapes; the accented range A-y is written \u00C0-\u1EF9.
 * These are byte-for-byte equivalent to the FE literals.)
 *
 * Idempotent: only fills rows where paragraph_anchor IS NULL. Safe to re-run.
 *
 * HOW TO RUN (from be/):
 *   dotenv -e .env -- ts-node prisma/backfill-paragraph-anchor.ts
 *   (or via the package.json script:  yarn prisma:backfill:paragraph-anchor)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---- Old-split helpers (verbatim from pre-port FE StoryReader) --------------

const normalizeStoryContent = (rawHtml: string) =>
  rawHtml
    .replace(/&nbs[p]?;?/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/([A-Za-z\u00C0-\u1EF90-9])\s*<br\s*\/?>\s*([A-Za-z\u00C0-\u1EF90-9])/g, '$1 $2')
    .replace(/([A-Za-z\u00C0-\u1EF90-9])\s*\r?\n\s*([A-Za-z\u00C0-\u1EF90-9])/g, '$1 $2');

const hasVisibleContent = (html: string) => {
  if (!html) return false;
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  return stripped.replace(/&nbs[p]?;?|\u00A0/gi, '').trim().length > 0;
};

/**
 * Reconstruct the OLD paragraph blocks (the `parts` array from the FE
 * splitParagraphs, minus the {id, index} wrapping). Returns the block HTML strings
 * in the same order/indexing the reader used before the merge.
 */
const splitOldParagraphBlocks = (content: string | null | undefined): string[] => {
  if (!content) return [];
  const normalizedHtml = normalizeStoryContent(content);
  const blockRegex = /<(p|div)\b[^>]*>[\s\S]*?<\/\1>/gi;
  const blocks = normalizedHtml.match(blockRegex) || [];

  let parts: string[] = blocks.map((block) => block.trim()).filter(hasVisibleContent);

  if (parts.length === 0) {
    parts = normalizedHtml
      .split(/\n{2,}|<br\s*\/?>/gi)
      .map((part) => part.trim())
      .filter(hasVisibleContent)
      .map((part) => (part.startsWith('<') ? part : `<p>${part}</p>`));
  }

  return parts;
};

// ---- Shared anchor algorithm (byte-identical to FE) -------------------------

const normFull = (s) => s
  .replace(/<[^>]*>/g, ' ')
  .replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, ' ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .toLowerCase();

const makeAnchor = (s: string) => normFull(s).slice(0, 100);

// ---- Backfill ---------------------------------------------------------------

async function main() {
  // Paragraph-scope comments are those with a non-null timestamp_seconds (= index).
  const comments = await prisma.chapterComment.findMany({
    where: {
      timestampSeconds: { not: null },
      paragraphAnchor: null,
    },
    select: {
      id: true,
      chapterId: true,
      timestampSeconds: true,
    },
  });

  console.log(`[backfill-paragraph-anchor] candidates: ${comments.length}`);

  // Cache chapter content so we hit the DB once per chapter.
  const chapterContentCache = new Map<string, string | null>();

  let processed = 0;
  let backfilled = 0;
  let skipped = 0;

  for (const comment of comments) {
    processed += 1;
    try {
      let content = chapterContentCache.get(comment.chapterId);
      if (content === undefined) {
        const chapter = await prisma.chapter.findUnique({
          where: { id: comment.chapterId },
          select: { content: true },
        });
        content = chapter?.content ?? null;
        chapterContentCache.set(comment.chapterId, content);
      }

      const oldBlocks = splitOldParagraphBlocks(content);
      const storedIndex = comment.timestampSeconds ?? 0;

      if (storedIndex < 0 || storedIndex >= oldBlocks.length) {
        // Index out of range for the old split -> leave anchor NULL (legacy fallback).
        skipped += 1;
        continue;
      }

      // Build a ~100-char content window spanning consecutive old blocks starting
      // at storedIndex. The new reader merges consecutive blocks into >=250-word
      // paragraphs, so oldBlocks[storedIndex] and the blocks that follow it live
      // CONTIGUOUSLY inside exactly one merged paragraph. Anchoring on the full
      // window (rather than block[storedIndex] alone) yields a long, unique anchor
      // even when that block is a short dialogue line like "Không." -> "không".
      let window = '';
      for (let i = storedIndex; i < oldBlocks.length; i += 1) {
        window = window ? `${window} ${oldBlocks[i]}` : oldBlocks[i];
        if (normFull(window).length >= 100) break;
      }

      const anchor = makeAnchor(window);
      if (!anchor) {
        // Window has no normalizable content -> an empty anchor would match every
        // paragraph, so leave it NULL instead.
        skipped += 1;
        continue;
      }

      await prisma.chapterComment.update({
        where: { id: comment.id },
        data: { paragraphAnchor: anchor },
      });
      backfilled += 1;
    } catch (err) {
      // A single bad chapter/comment must not abort the whole run.
      skipped += 1;
      console.error(`[backfill-paragraph-anchor] failed comment ${comment.id}:`, err);
    }
  }

  console.log(
    `[backfill-paragraph-anchor] done. processed=${processed} backfilled=${backfilled} skipped=${skipped}`,
  );
}

main()
  .catch((err) => {
    console.error('[backfill-paragraph-anchor] fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
