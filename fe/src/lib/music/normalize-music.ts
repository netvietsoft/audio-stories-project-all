import type { MusicApiItem, MusicContentType, MusicPlaylistTrackSummary, MusicTrack } from "@/types/music";

export const formatMusicDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "--:--";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

export const formatCompactCount = (value?: number) => {
  if (!value || value <= 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
};

export const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

const normalizeContentType = (value: unknown): MusicContentType => {
  return value === "playlist" ? "playlist" : "single";
};

const normalizePlaylistTrackIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );
};

const normalizePlaylistTracks = (value: unknown): MusicPlaylistTrackSummary[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<MusicPlaylistTrackSummary>;
      if (!row.id || !row.audioUrl) return null;

      return {
        id: row.id,
        title: (row.title || "").trim() || "Untitled",
        artist: (row.artist || "").trim() || "Unknown artist",
        thumbnailUrl: row.thumbnailUrl || null,
        audioUrl: row.audioUrl,
        audioDuration: typeof row.audioDuration === "number" ? row.audioDuration : null,
        playCount: typeof row.playCount === "number" ? row.playCount : 0,
        likeCount: typeof row.likeCount === "number" ? row.likeCount : 0,
        commentCount: typeof row.commentCount === "number" ? row.commentCount : 0,
      };
    })
    .filter((item): item is MusicPlaylistTrackSummary => Boolean(item));
};

export const normalizeMusicItem = (item: MusicApiItem, fallbackIndex?: number): MusicTrack => {
  const playlistTracks = normalizePlaylistTracks(item.playlistTracks);
  const contentType = normalizeContentType(item.contentType);

  return {
    ...item,
    title: item.title?.trim() || (typeof fallbackIndex === "number" ? `Track ${fallbackIndex + 1}` : "Track"),
    artist: item.artist?.trim() || "Unknown artist",
    description: item.description || null,
    tags: normalizeTags(item.tags),
    contentType,
    playlistTrackIds: normalizePlaylistTrackIds(item.playlistTrackIds),
    playlistTracks,
    thumbnailUrl: item.thumbnailUrl || (contentType === "playlist" ? playlistTracks[0]?.thumbnailUrl || null : null),
    audioUrl: item.audioUrl || playlistTracks[0]?.audioUrl || "",
    audioDuration:
      typeof item.audioDuration === "number"
        ? item.audioDuration
        : contentType === "playlist"
          ? playlistTracks.reduce((sum, row) => sum + (row.audioDuration || 0), 0)
          : null,
    playCount: item.playCount || 0,
    likeCount: item.likeCount || 0,
    commentCount: item.commentCount || 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    isPublic: item.isPublic,
  };
};
