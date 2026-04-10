import { apiClient } from "@/lib/api/api-client";

export type MusicComment = {
  id: string;
  musicId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

export type MusicCommentsResponse = {
  data: MusicComment[];
  meta: {
    total: number;
    page: number;
    lastPage: number;
  };
};

type CommentMutationResponse = {
  data: MusicComment;
};

export const listMusicComments = async (
  musicId: string,
  params: { page: number; limit?: number },
): Promise<MusicCommentsResponse> => {
  const response = await apiClient.get<MusicCommentsResponse>(`/music/${musicId}/comments`, {
    params,
  });

  return response.data;
};

export const createMusicComment = async (musicId: string, content: string): Promise<MusicComment | null> => {
  const response = await apiClient.post<CommentMutationResponse>(`/music/${musicId}/comments`, {
    content,
  });

  return response.data?.data || null;
};

export const updateMusicComment = async (commentId: string, content: string): Promise<MusicComment | null> => {
  const response = await apiClient.patch<CommentMutationResponse>(`/music/comments/${commentId}`, {
    content,
  });

  return response.data?.data || null;
};

export const deleteMusicComment = async (commentId: string): Promise<void> => {
  await apiClient.delete(`/music/comments/${commentId}`);
};
