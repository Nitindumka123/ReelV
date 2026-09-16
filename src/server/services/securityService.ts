export class SecurityService {
  private static readonly APPROVED_RESOLVE_HOSTS = new Set([
    'instagram.com',
    'www.instagram.com',
    'm.instagram.com'
  ]);

  private static readonly ALLOWED_MEDIA_DOMAINS = [
    'instagram.com',
    'cdninstagram.com',
    'fbcdn.net'
  ];

  /**
   * Protects against SSRF by validating the target URL for initial resolution.
   */
  static async validateForSSRF(url: string): Promise<boolean> {
    try {
      const parsed = new URL(url);
      
      // 1. Protocol check (strict HTTPS only)
      if (parsed.protocol !== 'https:') {
        return false;
      }

      // 2. Port check (standard HTTPS port 443 or default only)
      if (parsed.port && parsed.port !== '443') {
        return false;
      }

      // 3. Userinfo check (no user:pass@)
      if (parsed.username || parsed.password) {
        return false;
      }

      // 4. Hostname normalization
      let hostname = parsed.hostname.toLowerCase();
      if (hostname.endsWith('.')) {
        hostname = hostname.slice(0, -1);
      }

      // 5. Reject punycode or hex/octal/decimal/IPv6
      if (this.isSuspectHostname(hostname)) {
        return false;
      }

      // 6. Strict allowlist for initial Instagram URL
      return this.APPROVED_RESOLVE_HOSTS.has(hostname);
    } catch {
      return false;
    }
  }

  /**
   * Validates URLs coming back from yt-dlp or redirects for safe download streaming.
   */
  static validateUpstreamUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // 1. Strict HTTPS only
      if (parsed.protocol !== 'https:') {
        return false;
      }

      // 2. Standard HTTPS port only
      if (parsed.port && parsed.port !== '443') {
        return false;
      }

      // 3. Reject userinfo
      if (parsed.username || parsed.password) {
        return false;
      }

      // 4. Normalize hostname
      let hostname = parsed.hostname.toLowerCase();
      if (hostname.endsWith('.')) {
        hostname = hostname.slice(0, -1);
      }

      // 5. Reject IP addresses, punycode, internal aliases
      if (this.isSuspectHostname(hostname)) {
        return false;
      }

      // 6. Whitelist approved CDN/Instagram domains using exact subdomain hierarchy
      const isApprovedDomain = this.ALLOWED_MEDIA_DOMAINS.some(domain => {
        return hostname === domain || hostname.endsWith('.' + domain);
      });

      return isApprovedDomain;
    } catch {
      return false;
    }
  }

  /**
   * Checks whether the hostname is an IP address, localhost, private IP, punycode, or local alias.
   */
  private static isSuspectHostname(hostname: string): boolean {
    // Punycode check
    if (hostname.includes('xn--')) {
      return true;
    }

    // Local / private domain aliases
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.home') ||
      hostname.endsWith('.corp')
    ) {
      return true;
    }

    // Direct IPv4 check (decimal, standard, octal, hex, or single number)
    // Checks for standard dotted-quad
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(hostname)) {
      return true;
    }

    // Pure number notation (e.g. 2130706433 for 127.0.0.1) or hex/octal
    if (/^(0x[0-9a-f]+|\d+)$/i.test(hostname)) {
      return true;
    }

    // IPv6 bracketed or raw
    if (hostname.startsWith('[') || hostname.includes(':')) {
      return true;
    }

    // Block cloud metadata addresses or any 169.254, 10., 127., 192.168.
    if (
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('0.')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Sanitizes request body to prevent basic injection/abuse.
   */
  static sanitize(input: any): any {
    if (typeof input === 'string') {
      return input.trim().slice(0, 2048); // Bounded length
    }
    return input;
  }
}
