import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { spawn, ChildProcess } from "child_process";
import cors from "cors";
import helmet from "helmet";
import { Transform, Readable } from "stream";
import { createServer as createViteServer } from "vite";
import { UrlService } from "./src/server/services/urlService";
import { SecurityService } from "./src/server/services/securityService";
import { RateLimitService } from "./src/server/services/rateLimitService";
import { MediaResolver } from "./src/server/services/mediaResolver";
import { DownloadTokenService } from "./src/server/services/downloadTokenService";
import { logger } from "./src/server/utils/logger";
import { ResolveResponse, ErrorCode } from "./src/types";

function getClientIp(req: express.Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && /^[0-9a-fA-F:.]+$/.test(cf.trim())) return cf.trim();
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const candidate = xff.split(',')[0].trim();
    if (/^[0-9a-fA-F:.]+$/.test(candidate)) return candidate;
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

let extractorProcess: ChildProcess | null = null;

function startExtractorCompanion() {
  const extractorUrl = process.env.EXTRACTOR_URL || "http://127.0.0.1:8000";
  if (extractorUrl.includes("127.0.0.1") || extractorUrl.includes("localhost")) {
    const pyScript = path.join(process.cwd(), "extractor_service.py");
    if (fs.existsSync(pyScript)) {
      try {
        extractorProcess = spawn("python3", [pyScript], {
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            EXTRACTOR_HOST: "127.0.0.1",
            EXTRACTOR_PORT: "8000"
          }
        });

        extractorProcess.on("error", (err) => {
          logger.warn({
            requestId: "system",
            timestamp: new Date().toISOString(),
            endpoint: "extractor-companion",
            errorCode: "EXTRACTOR_SPAWN_ERROR",
            message: `Companion extractor process: ${err.message}`
          });
        });

        extractorProcess.on("exit", () => {
          extractorProcess = null;
        });
      } catch (e: any) {
        logger.warn({
          requestId: "system",
          timestamp: new Date().toISOString(),
          endpoint: "extractor-companion",
          errorCode: "EXTRACTOR_SPAWN_FAILED",
          message: e.message
        });
      }
    }
  }
}

function cleanupExtractor() {
  if (extractorProcess && !extractorProcess.killed) {
    try {
      extractorProcess.kill("SIGTERM");
    } catch {}
    extractorProcess = null;
  }
}

class StreamSizeLimitTransform extends Transform {
  private bytesTransferred = 0;
  constructor(private maxBytes: number) {
    super();
  }
  _transform(chunk: any, encoding: string, callback: (error?: Error | null, data?: any) => void) {
    this.bytesTransferred += chunk.length;
    if (this.bytesTransferred > this.maxBytes) {
      callback(new Error('STREAM_EXCEEDED_MAX_SIZE'));
    } else {
      callback(null, chunk);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  let activeResolves = 0;
  let activeDownloads = 0;
  const MAX_CONCURRENT_RESOLVE = parseInt(process.env.MAX_CONCURRENT_RESOLVE || process.env.MAX_CONCURRENT_RESOLVES || '3', 10);
  const MAX_CONCURRENT_DOWNLOAD = parseInt(process.env.MAX_CONCURRENT_DOWNLOAD || process.env.MAX_CONCURRENT_DOWNLOADS || '2', 10);
  const MAX_MEDIA_SIZE_BYTES = parseInt(process.env.MAX_MEDIA_SIZE_BYTES || '524288000', 10); // 500MB

  app.set("trust proxy", true); // Support Cloudflare and reverse proxies

  // Production Security Headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://*.cdninstagram.com",
          "https://*.fbcdn.net",
          "https://*.instagram.com",
          "https://*"
        ],
        connectSrc: ["'self'", "https://*.run.app", "http://localhost:*", "https://*"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'", "https://*.run.app", "https://ai.studio", "https://*.google.com"],
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));

  app.use(express.json({ limit: "1mb" })); // Add request body limit

  // CORS Configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || ['http://localhost:3000'];
  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL.trim());
  }

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl/healthchecks), allowed origins, or preview containers
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.run.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
  }));

  // SEO: Never index internal APIs or health checks
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/ready') {
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    next();
  });

  // Liveness Probe
  app.get("/health", (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Readiness Probe (verifies extractor backend connectivity)
  app.get(["/ready", "/api/ready"], async (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    try {
      const extractorHealthUrl = process.env.EXTRACTOR_HEALTH_URL || 
        (process.env.EXTRACTOR_URL ? (process.env.EXTRACTOR_URL.endsWith('/extract') ? process.env.EXTRACTOR_URL.replace(/\/extract$/, '/health') : process.env.EXTRACTOR_URL.replace(/\/+$/, '') + '/health') : 'http://127.0.0.1:8000/health');

      let externalHealthy = false;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const resp = await fetch(extractorHealthUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (resp.ok) externalHealthy = true;
      } catch {}

      if (externalHealthy) {
        return res.json({ status: "ready", provider: "python-ytdlp", uptime: process.uptime() });
      }

      // Check local yt-dlp binary fallback
      const hasLocalBinary = fs.existsSync(path.join(process.cwd(), 'yt-dlp-bin'));
      if (hasLocalBinary) {
        return res.json({ status: "ready", provider: "ytdlp-cli", uptime: process.uptime() });
      }

      if (process.env.RAPIDAPI_KEY) {
        return res.json({ status: "ready", provider: "rapidapi", uptime: process.uptime() });
      }

      return res.status(503).json({ status: "degraded", provider: "unreachable", uptime: process.uptime() });
    } catch {
      return res.status(503).json({ status: "degraded", provider: "unreachable", uptime: process.uptime() });
    }
  });

  // Legacy Health Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/health/provider", async (req, res) => {
    try {
      const extractorHealthUrl = process.env.EXTRACTOR_HEALTH_URL || "http://127.0.0.1:8000/health";
      let isUp = false;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(extractorHealthUrl, { signal: controller.signal });
        clearTimeout(timeout);
        isUp = response.ok;
      } catch {}

      if (isUp) {
        return res.json({ configured: true, available: true, provider: "python-ytdlp" });
      }

      const hasLocalBinary = fs.existsSync(path.join(process.cwd(), 'yt-dlp-bin'));
      if (hasLocalBinary) {
        return res.json({ configured: true, available: true, provider: "ytdlp-cli" });
      }

      return res.json({ configured: true, available: false, provider: "unreachable" });
    } catch {
      res.json({ configured: true, available: false });
    }
  });

  // API Routes
  app.post("/api/resolve", async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();
    const rawUrl = req.body.url;
    const ip = getClientIp(req);

    // Prevent caching on API responses
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Concurrency check
    if (activeResolves >= MAX_CONCURRENT_RESOLVE) {
      logger.warn({
        requestId,
        timestamp: new Date().toISOString(),
        endpoint: "/api/resolve",
        success: false,
        errorCode: "SERVER_BUSY",
        message: "Active resolution concurrency threshold reached"
      });
      return res.status(503).json({
        success: false,
        error: {
          code: "SERVER_BUSY",
          message: "The service is temporarily busy. Please retry shortly."
        },
        requestId
      });
    }

    activeResolves++;

    try {
      // 1. Sanitize & Normalize
      const url = SecurityService.sanitize(rawUrl);
      
      // 2. Rate Limiting
      const limit = RateLimitService.isLimited(ip);
      if (limit.limited) {
        logger.warn({
          requestId,
          timestamp: new Date().toISOString(),
          endpoint: "/api/resolve",
          success: false,
          errorCode: "RATE_LIMITED",
          message: `Rate limit exceeded for IP: ${ip}`
        });
        return res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later."
          },
          requestId
        });
      }

      // 3. Validation
      if (!url || !UrlService.validate(url)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_URL",
            message: "The provided URL is not a supported public Instagram URL."
          },
          requestId
        });
      }
      const normalizedUrl = UrlService.normalize(url);

      // 4. SSRF Protection
      const isSafe = await SecurityService.validateForSSRF(normalizedUrl);
      if (!isSafe) {
        logger.warn({
          requestId,
          timestamp: new Date().toISOString(),
          endpoint: "/api/resolve",
          success: false,
          errorCode: "SSRF_PROTECTION",
          message: `Blocked unsafe URL: ${normalizedUrl}`
        });
        return res.status(403).json({
          success: false,
          error: {
            code: "INVALID_URL",
            message: "The provided URL is blocked for security reasons."
          },
          requestId
        });
      }

      // 5. Media Resolution
      const resolver = new MediaResolver();
      const media = await resolver.resolve(normalizedUrl);
      const duration = Date.now() - startTime;

      logger.info({
        requestId,
        timestamp: new Date().toISOString(),
        endpoint: "/api/resolve",
        duration,
        urlType: media.type,
        success: true,
        message: "Media resolved successfully"
      });

      // 6. Generate Secure Download Token
      const token = DownloadTokenService.createToken(media.url, media.extension);
      media.url = `/api/download?token=${token}`; // Update the URL presented to the client

      const response: ResolveResponse = {
        success: true,
        media,
        requestId
      };
      
      res.json(response);

    } catch (err: any) {
      const duration = Date.now() - startTime;
      const errorCode = (err.code || "INTERNAL_ERROR") as ErrorCode;
      const statusCode = err.status || 500;
      
      const logPayload = {
        requestId,
        timestamp: new Date().toISOString(),
        endpoint: "/api/resolve",
        duration,
        success: false,
        errorCode,
        message: err.message || "Unknown error"
      };

      if (statusCode >= 500) {
        logger.error(logPayload);
      } else {
        logger.warn(logPayload);
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: err.message || "An unexpected error occurred during processing."
        },
        requestId
      });
    } finally {
      activeResolves--;
    }
  });

  // Download Route
  app.get("/api/download", async (req, res) => {
    const token = req.query.token as string;
    const ip = getClientIp(req);

    // Strict cache prevention headers for streaming download
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("X-Accel-Buffering", "no"); // Disable proxy buffering

    if (!token) {
      return res.status(400).send("Missing download token");
    }

    const tokenData = DownloadTokenService.getToken(token);
    if (!tokenData) {
      return res.status(403).send("Download link has expired or is invalid. Please process the URL again.");
    }

    // Download Rate Limiting
    const limit = RateLimitService.isDownloadLimited(ip);
    if (limit.limited) {
      return res.status(429).send("Too many download requests. Please wait a moment.");
    }

    // Concurrency Limiting
    if (activeDownloads >= MAX_CONCURRENT_DOWNLOAD) {
      return res.status(503).send("Download capacity temporarily saturated. Please retry in a few seconds.");
    }

    // Validate token URL against SSRF
    if (!SecurityService.validateUpstreamUrl(tokenData.url)) {
      return res.status(403).send("Upstream URL is not an approved media source.");
    }

    activeDownloads++;
    let hasDecrementedDownloads = false;
    const releaseDownloadSlot = () => {
      if (!hasDecrementedDownloads) {
        hasDecrementedDownloads = true;
        activeDownloads--;
      }
    };

    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 300000); // 5 min timeout

      req.on('close', () => {
        abortController.abort();
        releaseDownloadSlot();
      });

      res.on('finish', () => {
        releaseDownloadSlot();
      });

      // Connect to upstream media URL securely
      const parsedUrl = new URL(tokenData.url);
      if (parsedUrl.protocol !== "https:") {
        releaseDownloadSlot();
        return res.status(403).send("Upstream URL must be HTTPS");
      }

      const response = await fetch(tokenData.url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        redirect: "manual",
        signal: abortController.signal
      });
      
      clearTimeout(timeoutId);

      // Handle expected redirects safely
      let finalResponse = response;
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const redirectUrl = response.headers.get("location");
        if (!redirectUrl || !SecurityService.validateUpstreamUrl(redirectUrl)) {
          releaseDownloadSlot();
          return res.status(502).send("Invalid or insecure upstream redirect.");
        }
        
        const redirectAbort = new AbortController();
        const redirectTimeout = setTimeout(() => redirectAbort.abort(), 300000);
        req.on('close', () => redirectAbort.abort());
        finalResponse = await fetch(redirectUrl, {
           method: "GET",
           headers: {
             "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
           },
           signal: redirectAbort.signal
        });
        clearTimeout(redirectTimeout);
      }

      if (!finalResponse.ok) {
        const logData = {
           requestId: "download-stream",
           timestamp: new Date().toISOString(),
           endpoint: "/api/download",
           success: false,
           errorCode: "UPSTREAM_ERROR",
           message: `Upstream responded with ${finalResponse.status} for URL: ${tokenData.url}`
        };
        if (finalResponse.status >= 500) {
          logger.error(logData);
        } else {
          logger.warn(logData);
        }
        releaseDownloadSlot();
        return res.status(finalResponse.status).send(`Failed to stream media: Upstream returned ${finalResponse.status}`);
      }

      // Read necessary headers from upstream
      const contentType = finalResponse.headers.get("content-type") || "application/octet-stream";
      const contentLengthStr = finalResponse.headers.get("content-length");
      
      // Content-Type validation
      const allowedContentTypes = [
        "video/mp4", "video/quicktime", "video/x-m4v",
        "image/jpeg", "image/png", "image/webp", "application/octet-stream"
      ];
      const isAllowedType = allowedContentTypes.some(type => contentType.toLowerCase().includes(type));
      
      if (!isAllowedType || contentType.includes("text/html")) {
        logger.warn({
           requestId: "download-stream",
           timestamp: new Date().toISOString(),
           endpoint: "/api/download",
           success: false,
           errorCode: "UPSTREAM_ERROR",
           message: `Blocked invalid content type from upstream: ${contentType}`
        });
        releaseDownloadSlot();
        return res.status(502).send("Upstream provided invalid or dangerous content type.");
      }

      // Content-Length check if present
      if (contentLengthStr) {
        const contentLength = parseInt(contentLengthStr, 10);
        if (contentLength > MAX_MEDIA_SIZE_BYTES) {
           releaseDownloadSlot();
           return res.status(413).send("Upstream media exceeds the maximum allowed download size.");
        }
      }

      // Response headers to force attachment download
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${tokenData.filename}"`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (contentLengthStr) {
        res.setHeader("Content-Length", contentLengthStr);
      }

      const body = finalResponse.body as any; // ReadableStream
      if (!body) {
         releaseDownloadSlot();
         return res.status(500).send("No content in response.");
      }

      // Stream size limiter prevents unbounded data transfer even without content-length header
      const sizeLimiter = new StreamSizeLimitTransform(MAX_MEDIA_SIZE_BYTES);
      sizeLimiter.on('error', (err) => {
        logger.error({
          requestId: "download-stream",
          timestamp: new Date().toISOString(),
          endpoint: "/api/download",
          success: false,
          errorCode: "SIZE_LIMIT_EXCEEDED",
          message: "Streaming transfer exceeded max allowed file size"
        });
        releaseDownloadSlot();
        if (!res.headersSent) {
          res.status(413).send("Media stream exceeded size limit.");
        } else {
          res.destroy(err);
        }
      });

      Readable.fromWeb(body).pipe(sizeLimiter).pipe(res);
      
    } catch (e: any) {
      releaseDownloadSlot();
      if (e.name === 'AbortError') {
        logger.info({
           requestId: "download-stream",
           timestamp: new Date().toISOString(),
           endpoint: "/api/download",
           success: false,
           errorCode: "CLIENT_DISCONNECT",
           message: "Client disconnected or request aborted."
        });
        return;
      }

      logger.error({
           requestId: "download-stream",
           timestamp: new Date().toISOString(),
           endpoint: "/api/download",
           success: false,
           errorCode: "INTERNAL_ERROR",
           message: `Failed to stream media: ${e.message}`
      });
      if (!res.headersSent) {
         res.status(500).send("Error downloading media. Please try again.");
      } else {
         res.end();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start companion extractor if configured
  startExtractorCompanion();

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful Shutdown
  let isShuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`Received ${signal}. Gracefully shutting down HTTP server and background services...`);
    cleanupExtractor();

    server.close(() => {
      console.log("HTTP server stopped accepting new connections.");
      process.exit(0);
    });

    // Enforce hard timeout if active connections do not drain
    setTimeout(() => {
      console.error("Forced process exit after shutdown timeout.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception in server process:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection in server process:", reason);
});

startServer();
