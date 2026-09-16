import { MediaMetadata, MediaType } from '../../types';

export interface IMediaResolverProvider {
  resolve(url: string): Promise<MediaMetadata>;
}

/**
 * Real production provider adapter for an external media resolution API.
 * This has been updated to use our self-hosted FastAPI extractor service.
 */
export class ExternalApiProvider implements IMediaResolverProvider {
  private get baseUrl(): string {
    const raw = process.env.EXTRACTOR_URL || 'http://127.0.0.1:8000';
    if (raw.endsWith('/extract')) {
      return raw;
    }
    return raw.replace(/\/+$/, '') + '/extract';
  }

  private get timeoutMs(): number {
    const val = process.env.EXTRACTOR_TIMEOUT_MS;
    return val ? parseInt(val, 10) : 120000;
  }

  async resolve(url: string): Promise<MediaMetadata> {
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), this.timeoutMs);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url }),
        signal: abortController.signal
      });

      clearTimeout(timeoutId);
      
      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorData = data.error || {};
        const error = new Error(errorData.message || `Provider returned error: ${response.status}`);
        (error as any).code = errorData.code || 'PROVIDER_UNAVAILABLE';
        (error as any).status = response.status !== 200 ? response.status : 400;
        throw error;
      }

      // Normalization layer
      return this.normalizeResponse(url, data.media);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        const error = new Error('Provider request timed out.');
        (error as any).code = 'TIMEOUT';
        (error as any).status = 504;
        throw error;
      }
      
      // Pass through known errors
      if (err.code) throw err;

      const error = new Error('Failed to resolve media from provider.');
      (error as any).code = 'PROCESSING_FAILED';
      (error as any).status = 500;
      throw error;
    }
  }

  private normalizeResponse(originalUrl: string, data: any): MediaMetadata {
    // Determine type from URL
    let type: MediaType = 'reel';
    if (originalUrl.includes('/stories/')) type = 'story';
    if (originalUrl.includes('/highlights/')) type = 'highlight';

    // Different APIs return media in different structures.
    // Assume a generic array/object structure here:
    let mediaUrl = null;
    let thumbnail = null;

    if (Array.isArray(data) && data.length > 0) {
      mediaUrl = data[0].media || data[0].url || data[0].video;
      thumbnail = data[0].thumbnail || data[0].cover;
    } else if (data.media || data.url || data.video_url) {
      mediaUrl = data.media || data.url || data.video_url;
      thumbnail = data.thumbnail || data.cover_url || data.display_url;
    }

    if (!mediaUrl) {
      const error = new Error('No media URL returned by provider.');
      (error as any).code = 'MEDIA_NOT_FOUND';
      (error as any).status = 404;
      throw error;
    }

    // Verify it's not an HTML page
    if (mediaUrl.includes('.html')) {
       const error = new Error('Returned URL is an HTML page, not media.');
       (error as any).code = 'PROCESSING_FAILED';
       (error as any).status = 500;
       throw error;
    }

    return {
      type,
      url: mediaUrl,
      thumbnail: thumbnail || '',
      mimeType: mediaUrl.includes('.jpg') ? 'image/jpeg' : 'video/mp4', // Naive fallback
      extension: mediaUrl.split('?')[0].split('.').pop() || 'mp4',
      width: data.width || data[0]?.width || null,
      height: data.height || data[0]?.height || null,
      duration: null,
      size: null,
      quality: null
    };
  }
}

export class MediaResolver {
  private provider: IMediaResolverProvider;

  constructor() {
    this.provider = new ExternalApiProvider();
  }

  async resolve(url: string): Promise<MediaMetadata> {
    return this.provider.resolve(url);
  }
}
