import { apiClient } from "@/lib/api/api-client";
import { unwrapData, unwrapList } from "@/lib/api/unwrap";

export type MusicComment = {
  id: string;
  musicId: string;
  userId: string;
  parentId: string | null;
  content: string;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  children: MusicComment[];
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
  params: { page: number; limit?: number; sort?: "newest" | "oldest" },
): Promise<MusicCommentsResponse> => {
  const response = await apiClient.get<MusicCommentsResponse>(`/music/${musicId}/comments`, {
    params,
  });

  const body = response.data as unknown as { data?: unknown; meta?: MusicCommentsResponse["meta"] };
  const meta =
    (body?.data as { meta?: MusicCommentsResponse["meta"] } | undefined)?.meta ??
    body?.meta ?? { total: 0, page: params.page, lastPage: params.page };
  return {
    data: unwrapList<MusicComment>(body),
    meta,
  };
};

export const createMusicComment = async (musicId: string, content: string): Promise<MusicComment | null> => {
  const response = await apiClient.post<CommentMutationResponse>(`/music/${musicId}/comments`, {
    content,
  });

  return unwrapData<MusicComment>(response.data);
};

export const replyMusicComment = async (commentId: string, content: string): Promise<MusicComment | null> => {
  const response = await apiClient.post<CommentMutationResponse>(`/music/comments/${commentId}/reply`, {
    content,
  });

  return unwrapData<MusicComment>(response.data);
};

export const likeMusicComment = async (commentId: string): Promise<{ liked: boolean }> => {
  const response = await apiClient.post<{ data: { liked: boolean } }>(`/music/comments/${commentId}/like`);
  return unwrapData<{ liked: boolean }>(response.data) || { liked: true };
};

export const unlikeMusicComment = async (commentId: string): Promise<{ liked: boolean }> => {
  const response = await apiClient.delete<{ data: { liked: boolean } }>(`/music/comments/${commentId}/like`);
  return unwrapData<{ liked: boolean }>(response.data) || { liked: false };
};

export const updateMusicComment = async (commentId: string, content: string): Promise<MusicComment | null> => {
  const response = await apiClient.patch<CommentMutationResponse>(`/music/comments/${commentId}`, {
    content,
  });

  return unwrapData<MusicComment>(response.data);
};

export const deleteMusicComment = async (commentId: string): Promise<void> => {
  await apiClient.delete(`/music/comments/${commentId}`);
};
