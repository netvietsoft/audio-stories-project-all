export type MusicContentType = "single" | "playlist";

export type MusicPlaylistTrackSummary = {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  audioUrl: string;
  audioDuration: number | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
};

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  description: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  audioUrl: string;
  audioDuration: number | null;
  contentType: MusicContentType;
  playlistTrackIds: string[];
  playlistTracks: MusicPlaylistTrackSummary[];
  playCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt?: string;
  isPublic?: boolean;
};

export type MusicApiItem = Omit<MusicTrack, "tags" | "contentType" | "playlistTrackIds" | "playlistTracks"> & {
  tags: unknown;
  contentType?: unknown;
  playlistTrackIds?: unknown;
  playlistTracks?: unknown;
};
