import { MediaMetadata, MediaType } from '../../types';
import * as igPkg from 'instagram-url-direct';
import axios from 'axios';
import qs from 'qs';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';

export interface IMediaResolverProvider {
  resolve(url: string): Promise<MediaMetadata>;
}

const getInstagramUrl = (igPkg as any).instagramGetUrl || (igPkg as any).default?.instagramGetUrl;

/**
 * Extracts shortcode from standard Instagram URLs.
 */
function extractShortcode(url: string): string | null {
  const match = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Native Node.js media extractor provider.
 * Supports direct scraping and optional session cookies (INSTAGRAM_COOKIE)
 * to prevent anonymous rate-limiting/auth blocks.
 */
export class NativeNodeExtractorProvider implements IMediaResolverProvider {
  async resolve(url: string): Promise<MediaMetadata> {
    const cookie = process.env.INSTAGRAM_COOKIE?.trim();
    const shortcode = extractShortcode(url);

    // If an authenticated session cookie is provided, attempt authenticated GraphQL query first
    if (cookie && shortcode) {
      try {
        const authData = await this.fetchWithCookie(shortcode, cookie);
        if (authData) {
          return this.normalizeNativeResponse(url, authData);
        }
      } catch {
        // Fall back to standard extractor if cookie request fails
      }
    }

    if (typeof getInstagramUrl !== 'function') {
      const error = new Error('Native Instagram resolver is not available.');
      (error as any).code = 'PROCESSING_FAILED';
      (error as any).status = 500;
      throw error;
    }

    try {
      const data = await getInstagramUrl(url);

      if (!data) {
        const error = new Error('Could not extract media from the provided Instagram URL.');
        (error as any).code = 'MEDIA_NOT_FOUND';
        (error as any).status = 404;
        throw error;
      }

      return this.normalizeNativeResponse(url, data);
    } catch (err: any) {
      const msg = (err.message || '').toLowerCase();
      
      // Map common upstream Instagram restrictions
      if (
        msg.includes('401') ||
        msg.includes('login') ||
        msg.includes('require_login') ||
        msg.includes('not granting access') ||
        msg.includes('empty media response') ||
        msg.includes('unauthorized')
      ) {
        const error = new Error('Instagram requires authentication or blocked the automated request.');
        (error as any).code = 'PROVIDER_AUTH_ERROR';
        (error as any).status = 403;
        throw error;
      }

      if (msg.includes('private')) {
        const error = new Error('This content is from a private Instagram account.');
        (error as any).code = 'PRIVATE_CONTENT';
        (error as any).status = 403;
        throw error;
      }

      if (msg.includes('404') || msg.includes('not found') || msg.includes('deleted')) {
        const error = new Error('The requested media was not found or has been removed.');
        (error as any).code = 'MEDIA_NOT_FOUND';
        (error as any).status = 404;
        throw error;
      }

      if (msg.includes('429') || msg.includes('rate') || msg.includes('too many requests')) {
        const error = new Error('Instagram rate limit reached. Please try again in a few moments.');
        (error as any).code = 'PROVIDER_RATE_LIMITED';
        (error as any).status = 429;
        throw error;
      }

      if (err.code) throw err;

      const error = new Error(err.message || 'Failed to extract media from Instagram.');
      (error as any).code = 'PROCESSING_FAILED';
      (error as any).status = 500;
      throw error;
    }
  }

  private async fetchWithCookie(shortcode: string, cookie: string): Promise<any> {
    const csrfMatch = cookie.match(/csrftoken=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';

    const payload = qs.stringify({
      variables: JSON.stringify({
        shortcode,
        fetch_tagged_user_count: null,
        hoisted_comment_id: null,
        hoisted_reply_id: null
      }),
      doc_id: '9510064595728286'
    });

    const response = await axios.post('https://www.instagram.com/graphql/query', payload, {
      timeout: 10000,
      headers: {
        'Cookie': cookie,
        'X-CSRFToken': csrfToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.instagram.com/p/${shortcode}/`
      }
    });

    const media = response.data?.data?.xdt_shortcode_media;
    if (!media) return null;

    if (media.is_video) {
      return {
        url: media.video_url,
        thumbnail: media.display_url,
        dimensions: media.dimensions
      };
    }

    return {
      url: media.display_url,
      thumbnail: media.display_url,
      dimensions: media.dimensions
    };
  }

  private normalizeNativeResponse(originalUrl: string, data: any): MediaMetadata {
    let type: MediaType = 'reel';
    if (originalUrl.includes('/stories/')) type = 'story';
    if (originalUrl.includes('/highlights/')) type = 'highlight';

    let mediaUrl: string | null = null;
    let thumbnail: string | null = null;
    let width: number | null = null;
    let height: number | null = null;

    if (data.media_details && Array.isArray(data.media_details) && data.media_details.length > 0) {
      const detail = data.media_details[0];
      mediaUrl = detail.url;
      thumbnail = detail.thumbnail;
      if (detail.dimensions) {
        width = detail.dimensions.width || null;
        height = detail.dimensions.height || null;
      }
    } else if (data.url_list && Array.isArray(data.url_list) && data.url_list.length > 0) {
      mediaUrl = data.url_list[0];
    } else if (data.url || data.video_url || data.media) {
      mediaUrl = data.url || data.video_url || data.media;
      thumbnail = data.thumbnail || data.display_url || data.cover;
    }

    if (!mediaUrl) {
      const error = new Error('No downloadable media URL found in post.');
      (error as any).code = 'MEDIA_NOT_FOUND';
      (error as any).status = 404;
      throw error;
    }

    const isVideo = mediaUrl.includes('.mp4') || !mediaUrl.includes('.jpg');

    return {
      type,
      url: mediaUrl,
      thumbnail: thumbnail || '',
      mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
      extension: isVideo ? 'mp4' : 'jpg',
      width,
      height,
      duration: null,
      size: null,
      quality: null,
    };
  }
}

/**
 * RapidAPI provider for Instagram Reels.
 * Used when RAPIDAPI_KEY is configured in the environment.
 */
export class RapidApiProvider implements IMediaResolverProvider {
  private get apiKey(): string {
    return process.env.RAPIDAPI_KEY || '';
  }

  private get apiHost(): string {
    return process.env.RAPIDAPI_HOST || 'instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com';
  }

  async resolve(url: string): Promise<MediaMetadata> {
    if (!this.apiKey) {
      const error = new Error('RapidAPI key not configured');
      (error as any).code = 'PROVIDER_NOT_CONFIGURED';
      (error as any).status = 500;
      throw error;
    }

    try {
      const endpoint = `https://${this.apiHost}/get-info?url=${encodeURIComponent(url)}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost,
        }
      });

      if (!response.ok) {
        const status = response.status;
        const error = new Error(`RapidAPI provider returned status ${status}`);
        (error as any).code = status === 429 ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_UNAVAILABLE';
        (error as any).status = status >= 500 ? 502 : status;
        throw error;
      }

      const data = await response.json();
      return this.normalize(url, data);
    } catch (err: any) {
      if (err.code) throw err;
      const error = new Error('Failed to resolve media via RapidAPI provider.');
      (error as any).code = 'PROCESSING_FAILED';
      (error as any).status = 500;
      throw error;
    }
  }

  private normalize(originalUrl: string, data: any): MediaMetadata {
    let type: MediaType = 'reel';
    if (originalUrl.includes('/stories/')) type = 'story';
    if (originalUrl.includes('/highlights/')) type = 'highlight';

    const mediaUrl = data.download_url || data.video_url || data.url || data.media || data[0]?.url;
    const thumbnail = data.thumbnail || data.display_url || data.cover || '';

    if (!mediaUrl) {
      const error = new Error('No downloadable media URL found.');
      (error as any).code = 'MEDIA_NOT_FOUND';
      (error as any).status = 404;
      throw error;
    }

    const isVideo = mediaUrl.includes('.mp4') || !mediaUrl.includes('.jpg');

    return {
      type,
      url: mediaUrl,
      thumbnail,
      mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
      extension: isVideo ? 'mp4' : 'jpg',
      width: data.width || null,
      height: data.height || null,
      duration: null,
      size: null,
      quality: 'High Quality',
    };
  }
}

/**
 * Real production provider adapter for an external media resolution API.
 * Used if EXTRACTOR_URL points to an external microservice.
 */
export class ExternalApiProvider implements IMediaResolverProvider {
  private get baseUrl(): string {
    const raw = process.env.EXTRACTOR_URL || '';
    if (!raw) return '';
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
    if (!this.baseUrl) {
      throw new Error('External extractor URL not configured');
    }

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
      if (err.code && err.code !== 'ECONNREFUSED') throw err;

      // Handle connection failure / service down
      if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('fetch failed') || err.message?.includes('ECONNREFUSED')) {
        const error = new Error('Extractor service is unreachable or offline.');
        (error as any).code = 'PROVIDER_UNAVAILABLE';
        (error as any).status = 503;
        throw error;
      }

      if (err instanceof SyntaxError) {
        const error = new Error('Extractor service returned a malformed response.');
        (error as any).code = 'PROCESSING_FAILED';
        (error as any).status = 502;
        throw error;
      }

      const error = new Error(err.message || 'Failed to resolve media from provider.');
      (error as any).code = 'PROCESSING_FAILED';
      (error as any).status = 500;
      throw error;
    }
  }

  private normalizeResponse(originalUrl: string, data: any): MediaMetadata {
    let type: MediaType = 'reel';
    if (originalUrl.includes('/stories/')) type = 'story';
    if (originalUrl.includes('/highlights/')) type = 'highlight';

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
      mimeType: mediaUrl.includes('.jpg') ? 'image/jpeg' : 'video/mp4',
      extension: mediaUrl.split('?')[0].split('.').pop() || 'mp4',
      width: data.width || data[0]?.width || null,
      height: data.height || data[0]?.height || null,
      duration: null,
      size: null,
      quality: null
    };
  }
}

export class YtDlpCliProvider implements IMediaResolverProvider {
  private static activeCount = 0;
  private static MAX_CONCURRENCY = 2;

  private findYtDlpBinary(): string | null {
    const candidates = [
      path.join(process.cwd(), 'yt-dlp-bin'),
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      'yt-dlp'
    ];
    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) return c;
      } catch {}
    }
    return null;
  }

  isAvailable(): boolean {
    return !!this.findYtDlpBinary();
  }

  async resolve(url: string): Promise<MediaMetadata> {
    const binary = this.findYtDlpBinary();
    if (!binary) {
      const error = new Error('yt-dlp binary is not installed');
      (error as any).code = 'PROVIDER_UNAVAILABLE';
      (error as any).status = 503;
      throw error;
    }

    if (YtDlpCliProvider.activeCount >= YtDlpCliProvider.MAX_CONCURRENCY) {
      const error = new Error('Extractor service is busy processing other requests.');
      (error as any).code = 'PROVIDER_RATE_LIMITED';
      (error as any).status = 429;
      throw error;
    }

    YtDlpCliProvider.activeCount++;

    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        if (!settled) {
          settled = true;
          YtDlpCliProvider.activeCount = Math.max(0, YtDlpCliProvider.activeCount - 1);
        }
      };

      execFile(
        binary,
        ['--no-warnings', '--dump-json', '--no-playlist', '--socket-timeout', '15', url],
        { timeout: 45000, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          cleanup();
          if (error) {
            const errOutput = (stderr || stdout || error.message || '').toLowerCase();
            if (error.killed) {
              const err = new Error('Media extraction timed out.');
              (err as any).code = 'TIMEOUT';
              (err as any).status = 504;
              return reject(err);
            }
            if (errOutput.includes('private')) {
              const err = new Error('This Instagram content is private.');
              (err as any).code = 'PRIVATE_CONTENT';
              (err as any).status = 403;
              return reject(err);
            }
            if (errOutput.includes('429') || errOutput.includes('rate') || errOutput.includes('too many requests')) {
              const err = new Error('Instagram rate limit reached.');
              (err as any).code = 'PROVIDER_RATE_LIMITED';
              (err as any).status = 429;
              return reject(err);
            }
            if (errOutput.includes('not found') || errOutput.includes('404') || errOutput.includes('deleted')) {
              const err = new Error('The requested media was not found or has been removed.');
              (err as any).code = 'MEDIA_NOT_FOUND';
              (err as any).status = 404;
              return reject(err);
            }
            if (errOutput.includes('login') || errOutput.includes('empty media response') || errOutput.includes('checkpoint')) {
              const err = new Error('Instagram requires authentication or blocked the automated request.');
              (err as any).code = 'PROVIDER_AUTH_ERROR';
              (err as any).status = 403;
              return reject(err);
            }

            const err = new Error('Failed to resolve media from Instagram.');
            (err as any).code = 'PROCESSING_FAILED';
            (err as any).status = 500;
            return reject(err);
          }

          try {
            const data = JSON.parse(stdout);
            const formats = data.formats || [];
            const progressive = formats.filter(
              (f: any) => f.vcodec !== 'none' && f.acodec !== 'none' && f.url
            );

            let bestUrl = '';
            let bestWidth: number | null = null;
            let bestHeight: number | null = null;

            if (progressive.length > 0) {
              progressive.sort((a: any, b: any) => ((a.width || 0) * (a.height || 0)) - ((b.width || 0) * (b.height || 0)));
              const best = progressive[progressive.length - 1];
              bestUrl = best.url;
              bestWidth = best.width || null;
              bestHeight = best.height || null;
            } else if (data.url) {
              bestUrl = data.url;
              bestWidth = data.width || null;
              bestHeight = data.height || null;
            } else if (data.requested_formats && data.requested_formats.length > 0) {
              bestUrl = data.requested_formats[0].url;
              bestWidth = data.requested_formats[0].width || null;
              bestHeight = data.requested_formats[0].height || null;
            }

            if (!bestUrl) {
              const err = new Error('No downloadable media stream found in post.');
              (err as any).code = 'MEDIA_NOT_FOUND';
              (err as any).status = 404;
              return reject(err);
            }

            let type: MediaType = 'reel';
            if (url.includes('/stories/')) type = 'story';
            if (url.includes('/highlights/')) type = 'highlight';

            const isVideo = bestUrl.includes('.mp4') || data.ext === 'mp4';
            const metadata: MediaMetadata = {
              type,
              url: bestUrl,
              thumbnail: data.thumbnail || '',
              mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
              extension: isVideo ? 'mp4' : 'jpg',
              width: bestWidth || data.width || null,
              height: bestHeight || data.height || null,
              duration: data.duration || null,
              size: null,
              quality: bestHeight ? `${bestHeight}p` : 'High Quality'
            };

            resolve(metadata);
          } catch (e: any) {
            const err = new Error('Failed to parse extractor response.');
            (err as any).code = 'PROCESSING_FAILED';
            (err as any).status = 500;
            reject(err);
          }
        }
      );
    });
  }
}

export class MediaResolver {
  private externalProvider: ExternalApiProvider;
  private ytdlpCliProvider: YtDlpCliProvider;
  private rapidApiProvider: RapidApiProvider;
  private nativeProvider: NativeNodeExtractorProvider;

  constructor() {
    this.externalProvider = new ExternalApiProvider();
    this.ytdlpCliProvider = new YtDlpCliProvider();
    this.rapidApiProvider = new RapidApiProvider();
    this.nativeProvider = new NativeNodeExtractorProvider();
  }

  async resolve(url: string): Promise<MediaMetadata> {
    const extractorUrl = process.env.EXTRACTOR_URL;
    if (extractorUrl) {
      try {
        return await this.externalProvider.resolve(url);
      } catch (err: any) {
        // If external service timed out or was unavailable, fall back
        if (err.code === 'PROVIDER_UNAVAILABLE' || err.code === 'TIMEOUT') {
          return await this.resolveWithFallbacks(url);
        }
        throw err;
      }
    }

    return this.resolveWithFallbacks(url);
  }

  private async resolveWithFallbacks(url: string): Promise<MediaMetadata> {
    if (this.ytdlpCliProvider.isAvailable()) {
      try {
        return await this.ytdlpCliProvider.resolve(url);
      } catch (err: any) {
        if (err.code === 'PROVIDER_UNAVAILABLE' || err.code === 'PROVIDER_RATE_LIMITED' || err.code === 'TIMEOUT') {
          // Fall back to subsequent providers
        } else {
          throw err;
        }
      }
    }

    if (process.env.RAPIDAPI_KEY) {
      try {
        return await this.rapidApiProvider.resolve(url);
      } catch (err: any) {
        if (err.code === 'PROVIDER_RATE_LIMITED' || err.code === 'PROVIDER_UNAVAILABLE') {
          return await this.nativeProvider.resolve(url);
        }
        throw err;
      }
    }

    return this.nativeProvider.resolve(url);
  }
}
