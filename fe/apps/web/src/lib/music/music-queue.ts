import type { AudioTrack } from "@/stores/audio-store";
import type { MusicTrack } from "@/types/music";

const DEFAULT_MUSIC_THUMBNAIL = "/thumbnaildefault.jpg";

export const toSingleQueueTrack = (track: MusicTrack): AudioTrack => ({
  id: track.id,
  title: track.title,
  author: track.artist,
  audioUrl: track.audioUrl,
  coverUrl: track.thumbnailUrl || DEFAULT_MUSIC_THUMBNAIL,
  hlsUrl: track.hlsUrl ?? null,
  audioStatus: track.audioStatus,
});

export const toPlaylistQueue = (track: MusicTrack): AudioTrack[] =>
  (track.playlistTracks || []).map((item, index) => ({
    id: `playlist:${track.id}:${item.id}:${index}`,
    title: item.title,
    author: item.artist,
    audioUrl: item.audioUrl,
    coverUrl: item.thumbnailUrl || track.thumbnailUrl || DEFAULT_MUSIC_THUMBNAIL,
  }));

export const toMusicQueue = (tracks: MusicTrack[]): AudioTrack[] =>
  tracks.flatMap((track) => (track.contentType === "playlist" ? toPlaylistQueue(track) : [toSingleQueueTrack(track)]));

export const isMusicTrackActive = (track: MusicTrack, currentTrack: AudioTrack | null): boolean => {
  if (!currentTrack) return false;

  if (track.contentType !== "playlist") {
    return currentTrack.id === track.id;
  }

  return toPlaylistQueue(track).some((item) => item.id === currentTrack.id);
};
