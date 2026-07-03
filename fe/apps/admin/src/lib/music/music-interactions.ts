import { apiClient } from "@/lib/api/api-client";
import { unwrapData } from "@/lib/api/unwrap";

export type MusicLikeStatusResponse = {
  data: {
    liked: boolean;
  };
};

export type MusicLikeActionResponse = {
  data: {
    liked: boolean;
    likeCount: number;
  };
};

export type MusicAccessStatusResponse = {
  data: {
    musicId: string;
    contentType: "single" | "podcast" | "playlist";
    accessType: "free" | "vip";
    unlockPrice: number;
    unlocked: boolean;
    canPlay: boolean;
    unlockSource: "free" | "track" | "playlist" | null;
  };
};

export type UnlockMusicResponse = {
  data: {
    musicId: string;
    contentType: "single" | "podcast" | "playlist";
    unlocked: boolean;
    unlockPrice: number;
    chargedCredits: number;
    balance: number;
    unlockSource?: "free" | "track" | "playlist" | null;
    unlockTargetCount?: number;
  };
};

export const registerMusicPlayback = async (musicId: string, withHistory: boolean) => {
  await apiClient.post(`/music/${musicId}/play`);

  if (withHistory) {
    await apiClient.post(`/music/interactions/${musicId}/history`);
  }
};

export const fetchMusicLikeStatus = async (musicId: string): Promise<boolean> => {
  const response = await apiClient.get<MusicLikeStatusResponse>(`/music/interactions/${musicId}/liked`);
  return Boolean(unwrapData<{ liked: boolean }>(response.data)?.liked);
};

export const toggleMusicLike = async (
  musicId: string,
  isCurrentlyLiked: boolean,
): Promise<{ liked: boolean; likeCount: number | null }> => {
  if (isCurrentlyLiked) {
    const response = await apiClient.delete<MusicLikeActionResponse>(`/music/interactions/${musicId}/like`);
    const payload = unwrapData<{ liked: boolean; likeCount: number }>(response.data);
    return {
      liked: false,
      likeCount: typeof payload?.likeCount === "number" ? payload.likeCount : null,
    };
  }

  const response = await apiClient.post<MusicLikeActionResponse>(`/music/interactions/${musicId}/like`);
  const payload = unwrapData<{ liked: boolean; likeCount: number }>(response.data);
  return {
    liked: true,
    likeCount: typeof payload?.likeCount === "number" ? payload.likeCount : null,
  };
};

export const fetchMusicAccessStatus = async (musicId: string) => {
  const response = await apiClient.get<MusicAccessStatusResponse>(`/music/interactions/${musicId}/access`);
  return unwrapData<MusicAccessStatusResponse["data"]>(response.data);
};

export const unlockMusicItem = async (musicId: string) => {
  const response = await apiClient.post<UnlockMusicResponse>(`/music/interactions/${musicId}/unlock`);
  return unwrapData<UnlockMusicResponse["data"]>(response.data);
};
