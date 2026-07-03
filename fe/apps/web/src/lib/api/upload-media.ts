import type { AxiosProgressEvent } from 'axios';

import { apiClient } from '@/lib/api/api-client';

export type UploadAudioResponse = {
  url: string;
};

export const uploadAudioToR2 = async (
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'chapters');

  const response = await apiClient.post<UploadAudioResponse>('/upload/audio', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!event.total) return;
      const percent = Math.round((event.loaded * 100) / event.total);
      onProgress?.(percent);
    },
  });

  return response.data.url;
};
