import { MediaType } from '../../types';

export class UrlService {
  /**
   * Normalizes an Instagram URL for processing.
   */
  static normalize(url: string): string {
    try {
      const parsed = new URL(url.trim());
      
      // Basic normalization
      let normalized = parsed.origin + parsed.pathname;
      
      // Remove trailing slash for consistency
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      
      return normalized;
    } catch {
      return url.trim();
    }
  }

  /**
   * Validates if the URL is a supported public Instagram URL.
   */
  static validate(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Host check
      const validHosts = ['instagram.com', 'www.instagram.com', 'm.instagram.com'];
      if (!validHosts.includes(parsed.hostname)) {
        return false;
      }

      // Path check
      const supportedPaths = ['/reel', '/reels', '/stories', '/highlights', '/p'];
      return supportedPaths.some(path => parsed.pathname.startsWith(path));
    } catch {
      return false;
    }
  }

  /**
   * Detects the media type from the URL.
   */
  static detectType(url: string): MediaType {
    const path = new URL(url).pathname;
    if (path.startsWith('/reel') || path.startsWith('/reels')) return 'reel';
    if (path.startsWith('/stories')) return 'story';
    if (path.startsWith('/highlights')) return 'highlight';
    if (path.startsWith('/p')) return 'reel'; // Posts can be reels
    return 'unknown';
  }
}
