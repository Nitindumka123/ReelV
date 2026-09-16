export class RateLimitService {
  private static requests = new Map<string, { count: number; reset: number }>();
  private static downloadRequests = new Map<string, { count: number; reset: number }>();
  
  private static readonly MAX_TRACKED_IPS = 20000;

  private static get WINDOW_MS(): number {
    const val = process.env.RATE_LIMIT_WINDOW_MS;
    return val ? parseInt(val, 10) : 60 * 1000; // default 1 minute
  }

  private static get MAX_REQUESTS(): number {
    const val = process.env.RATE_LIMIT_MAX_REQUESTS;
    return val ? parseInt(val, 10) : 10; // default 10 requests per minute
  }

  private static get DOWNLOAD_MAX_REQUESTS(): number {
    const val = process.env.DOWNLOAD_RATE_LIMIT_MAX || process.env.DOWNLOAD_RATE_LIMIT_MAX_REQUESTS;
    return val ? parseInt(val, 10) : 10; // default 10 downloads per minute
  }

  /**
   * Checks if a request for media resolution should be rate limited.
   */
  static isLimited(identifier: string): { limited: boolean; reset: number } {
    this.cleanupIfNeeded(this.requests);
    return this.checkLimit(this.requests, identifier, this.MAX_REQUESTS, this.WINDOW_MS);
  }

  /**
   * Checks if a download stream request should be rate limited.
   */
  static isDownloadLimited(identifier: string): { limited: boolean; reset: number } {
    this.cleanupIfNeeded(this.downloadRequests);
    return this.checkLimit(this.downloadRequests, identifier, this.DOWNLOAD_MAX_REQUESTS, this.WINDOW_MS);
  }

  private static checkLimit(
    store: Map<string, { count: number; reset: number }>,
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): { limited: boolean; reset: number } {
    const now = Date.now();
    const record = store.get(identifier);

    if (!record || now > record.reset) {
      store.set(identifier, { count: 1, reset: now + windowMs });
      return { limited: false, reset: now + windowMs };
    }

    if (record.count >= maxRequests) {
      return { limited: true, reset: record.reset };
    }

    record.count++;
    return { limited: false, reset: record.reset };
  }

  private static cleanupIfNeeded(store: Map<string, { count: number; reset: number }>) {
    if (store.size > this.MAX_TRACKED_IPS) {
      const now = Date.now();
      for (const [key, value] of store.entries()) {
        if (now > value.reset) {
          store.delete(key);
        }
      }
      // If still above threshold, drop oldest items
      if (store.size > this.MAX_TRACKED_IPS) {
        const keys = Array.from(store.keys());
        for (let i = 0; i < 2000 && i < keys.length; i++) {
          store.delete(keys[i]);
        }
      }
    }
  }
}
