export type MusicContentType = "single" | "podcast" | "playlist";
export type MusicAccessType = "free" | "vip";

export type MusicPlaylistTrackSummary = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  accessType: MusicAccessType;
  originalUnlockPrice?: number | null;
  discountPercent?: number;
  unlockPrice: number;
  thumbnailUrl: string | null;
  audioUrl: string;
  audioDuration: number | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
};

export type MusicTrack = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  description: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  audioUrl: string;
  audioDuration: number | null;
  contentType: MusicContentType;
  accessType: MusicAccessType;
  originalUnlockPrice?: number | null;
  discountPercent?: number;
  unlockPrice: number;
  introEnabled: boolean;
  playlistTrackIds: string[];
  playlistTracks: MusicPlaylistTrackSummary[];
  playCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt?: string;
  isPublic?: boolean;
  // --- HLS pipeline ---
  hlsUrl?: string | null;
  audioStatus?: "none" | "uploaded" | "processing" | "ready" | "failed";
};

export type MusicApiItem = Omit<MusicTrack, "tags" | "contentType" | "playlistTrackIds" | "playlistTracks"> & {
  tags: unknown;
  contentType?: unknown;
  playlistTrackIds?: unknown;
  playlistTracks?: unknown;
};
