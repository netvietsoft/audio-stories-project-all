export const CLEAN_CHAPTER_REGEX = /^(?:\s*(?:Chương|Chapter)\s*\d+\s*[:\-–—\.]?\s*)/i;

export function cleanChapterTitle(title?: string | null) {
  if (!title) return "";
  return title.replace(CLEAN_CHAPTER_REGEX, "").trim();
}

export function formatChapterTitle(prefix: string, chapterNumber?: number | null, title?: string | null) {
  const num = Number(chapterNumber || 0);
  const clean = cleanChapterTitle(title || "");
  if (num && clean) return `${prefix} ${num}: ${clean}`;
  if (num) return `${prefix} ${num}`;
  return clean || "";
}
