import "dotenv/config";
import { SecurityService } from "../services/securityService";
import { DownloadTokenService } from "../services/downloadTokenService";
import { RateLimitService } from "../services/rateLimitService";

export async function runTestSuite() {
  console.log("=== ReelVault Production Security & Reliability Test Suite ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. SSRF & URL Validation Tests
  console.log("\n[Test Group 1: SSRF Validation]");
  assert(await SecurityService.validateForSSRF("https://www.instagram.com/reel/C3R1aC9L5U0/"), "Valid instagram.com URL is allowed");
  assert(await SecurityService.validateForSSRF("https://instagram.com/p/C3R1aC9L5U0/"), "Valid short domain is allowed");
  assert(await SecurityService.validateForSSRF("https://m.instagram.com/stories/user/123/"), "Mobile subdomain is allowed");
  
  // Rejections
  assert(!(await SecurityService.validateForSSRF("http://www.instagram.com/reel/xyz/")), "HTTP protocol rejected (downgrade)");
  assert(!(await SecurityService.validateForSSRF("https://instagram.com:8443/reel/xyz/")), "Non-standard port rejected");
  assert(!(await SecurityService.validateForSSRF("https://user:pass@instagram.com/reel/xyz/")), "Userinfo URLs rejected");
  assert(!(await SecurityService.validateForSSRF("https://localhost/reel/xyz")), "Localhost rejected");
  assert(!(await SecurityService.validateForSSRF("https://127.0.0.1/reel/xyz")), "Loopback IPv4 rejected");
  assert(!(await SecurityService.validateForSSRF("https://[::1]/reel/xyz")), "Loopback IPv6 rejected");
  assert(!(await SecurityService.validateForSSRF("https://169.254.169.254/metadata")), "Link-local cloud metadata rejected");
  assert(!(await SecurityService.validateForSSRF("https://10.0.0.1/admin")), "Private 10.x.x.x network rejected");
  assert(!(await SecurityService.validateForSSRF("https://192.168.1.1/router")), "Private 192.168.x.x rejected");
  assert(!(await SecurityService.validateForSSRF("https://evil-instagram.com/reel/xyz")), "Domain suffix impersonation rejected");
  assert(!(await SecurityService.validateForSSRF("https://instagram.com.evil.com/reel/xyz")), "Prefix hijacking rejected");
  assert(!(await SecurityService.validateForSSRF("https://xn--instagram-94a.com/reel/xyz")), "Punycode domain rejected");

  // 2. Upstream Media URL Validation
  console.log("\n[Test Group 2: Upstream Media Validation]");
  assert(SecurityService.validateUpstreamUrl("https://scontent.cdninstagram.com/v/t51.2885-15/video.mp4"), "Approved cdninstagram.com is allowed");
  assert(SecurityService.validateUpstreamUrl("https://instagram.fsnc1-1.fna.fbcdn.net/v/t51.2885-15/media.mp4"), "Approved fbcdn.net is allowed");
  assert(!SecurityService.validateUpstreamUrl("http://scontent.cdninstagram.com/v/video.mp4"), "HTTP upstream rejected");
  assert(!SecurityService.validateUpstreamUrl("https://malicious-cdn.com/exploit.mp4"), "Unapproved external domain rejected");
  assert(!SecurityService.validateUpstreamUrl("https://169.254.169.254/latest/meta-data"), "Private IP upstream rejected");

  // 3. Download Token Service
  console.log("\n[Test Group 3: Download Token Service]");
  const token = DownloadTokenService.createToken("https://scontent.cdninstagram.com/v/sample.mp4", "mp4");
  assert(typeof token === "string" && token.length === 64, "Generated token is 64-char hex");
  
  const tokenData = DownloadTokenService.getToken(token);
  assert(tokenData !== null && tokenData.filename.includes("ReelVault_Instagram_Media_"), "Token retrieval succeeds with valid filename");
  assert(DownloadTokenService.getToken("invalid_or_non_existent_token_1234567890abcdef1234567890abcdef12") === null, "Invalid token returns null");
  assert(DownloadTokenService.getToken("short") === null, "Malformed short token returns null");

  // 4. Rate Limiting Tests
  console.log("\n[Test Group 4: Rate Limiting]");
  const testIp = "test-client-ip-123";
  let wasLimited = false;
  const maxReq = process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) : 10;
  for (let i = 0; i < maxReq + 5; i++) {
    const res = RateLimitService.isLimited(testIp);
    if (res.limited) {
      wasLimited = true;
      break;
    }
  }
  assert(wasLimited, `Rate limiter triggers after threshold (${maxReq}) requests`);

  // Download rate limit test
  const testDlIp = "test-download-ip-456";
  let wasDlLimited = false;
  const maxDlReq = process.env.DOWNLOAD_RATE_LIMIT_MAX ? parseInt(process.env.DOWNLOAD_RATE_LIMIT_MAX, 10) : 10;
  for (let i = 0; i < maxDlReq + 5; i++) {
    const res = RateLimitService.isDownloadLimited(testDlIp);
    if (res.limited) {
      wasDlLimited = true;
      break;
    }
  }
  assert(wasDlLimited, `Download rate limiter triggers after threshold (${maxDlReq}) requests`);

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

if (process.argv[1]?.endsWith("securityAndReadiness.test.ts")) {
  runTestSuite().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
