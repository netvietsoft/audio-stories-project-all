import { apiClient } from "@/lib/api/api-client";

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

export const registerMusicPlayback = async (musicId: string, withHistory: boolean) => {
  await apiClient.post(`/music/${musicId}/play`);

  if (withHistory) {
    await apiClient.post(`/music/interactions/${musicId}/history`);
  }
};

export const fetchMusicLikeStatus = async (musicId: string): Promise<boolean> => {
  const response = await apiClient.get<MusicLikeStatusResponse>(`/music/interactions/${musicId}/liked`);
  return Boolean(response.data?.data?.liked);
};

export const toggleMusicLike = async (
  musicId: string,
  isCurrentlyLiked: boolean,
): Promise<{ liked: boolean; likeCount: number | null }> => {
  if (isCurrentlyLiked) {
    const response = await apiClient.delete<MusicLikeActionResponse>(`/music/interactions/${musicId}/like`);
    return {
      liked: false,
      likeCount: typeof response.data?.data?.likeCount === "number" ? response.data.data.likeCount : null,
    };
  }

  const response = await apiClient.post<MusicLikeActionResponse>(`/music/interactions/${musicId}/like`);
  return {
    liked: true,
    likeCount: typeof response.data?.data?.likeCount === "number" ? response.data.data.likeCount : null,
  };
};
