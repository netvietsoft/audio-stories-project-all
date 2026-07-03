export interface ApiSuccess<T> {
  data: T;
  meta: { requestId?: string; pagination?: { cursor?: string; nextCursor?: string; limit?: number; total?: number } };
}

export interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
  meta: { requestId?: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function isApiError(r: ApiResponse<unknown>): r is ApiError {
  return (r as ApiError).error !== undefined;
}
