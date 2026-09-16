import { ResolveResponse, MediaMetadata } from '../types';

/**
 * API service to resolve Instagram media via the backend.
 */
export const resolveMedia = async (url: string): Promise<MediaMetadata> => {
  const response = await fetch('/api/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  const data: ResolveResponse = await response.json();

  if (!data.success || !data.media) {
    const error = new Error(data.error?.message || 'Processing failed');
    (error as any).code = data.error?.code || 'INTERNAL_ERROR';
    (error as any).requestId = data.requestId;
    throw error;
  }

  return data.media;
};
