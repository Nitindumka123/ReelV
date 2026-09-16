import crypto from "crypto";

interface TokenData {
  url: string;
  filename: string;
  expiresAt: number;
}

export class DownloadTokenService {
  private static store = new Map<string, TokenData>();
  
  private static get TTL_MS(): number {
    const val = process.env.TOKEN_TTL_MS;
    return val ? parseInt(val, 10) : 3600000; // 1 hour default
  }

  private static get MAX_TOKENS(): number {
    const val = process.env.MAX_ACTIVE_TOKENS;
    return val ? parseInt(val, 10) : 10000;
  }

  static createToken(url: string, extension: string): string {
    // Cleanup expired
    this.cleanup();

    if (this.store.size >= this.MAX_TOKENS) {
      // Eviction: remove oldest expired or entries
      const keys = Array.from(this.store.keys());
      for (let i = 0; i < 1000 && i < keys.length; i++) {
        this.store.delete(keys[i]);
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    
    // Strict extension sanitizer (only allowed safe extensions)
    const safeExt = this.sanitizeExtension(extension);
    const randomSuffix = crypto.randomBytes(4).toString("hex");
    const filename = `ReelVault_Instagram_Media_${randomSuffix}.${safeExt}`;
    
    this.store.set(token, {
      url,
      filename,
      expiresAt: Date.now() + this.TTL_MS,
    });
    
    return token;
  }

  static getToken(token: string): TokenData | null {
    if (!token || typeof token !== "string" || token.length !== 64 || !/^[0-9a-f]+$/i.test(token)) {
      return null;
    }

    const data = this.store.get(token);
    if (!data) return null;
    
    if (Date.now() > data.expiresAt) {
      this.store.delete(token);
      return null;
    }
    
    return data;
  }

  private static sanitizeExtension(ext: string): string {
    if (!ext || typeof ext !== 'string') return 'mp4';
    const cleaned = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
    const allowed = ['mp4', 'mov', 'm4v', 'jpg', 'jpeg', 'png', 'webp'];
    return allowed.includes(cleaned) ? cleaned : 'mp4';
  }

  private static cleanup() {
    const now = Date.now();
    for (const [token, data] of this.store.entries()) {
      if (now > data.expiresAt) {
        this.store.delete(token);
      }
    }
  }
}
