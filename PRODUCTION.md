# ReelVault — Production Architecture & Operational Runbook

## 1. System Components

### 1.1 Client-Side Layer (React 19 + Tailwind CSS)
- **Zero Heavy Framework Overhead**: Built with Vite and React 19, delivering minimal bundle sizes and instant load times.
- **Client-Side Fast Feedback**: Validates URL structure and pattern matching before initiating network requests to minimize unnecessary backend load.
- **Accessible & Responsive**: Fully WCAG AA compliant with keyboard accessibility, semantic HTML, visible focus states, and tailored layouts across mobile, tablet, and desktop screens.

### 1.2 API & Ingress Layer (Node.js + Express)
- **Helmet Security**: Strict Content-Security-Policy (CSP), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
- **Cloudflare & Reverse Proxy Awareness**: Accurately resolves client IP via `CF-Connecting-IP` and `X-Forwarded-For` with `trust proxy` enabled.
- **Active Concurrency Safeguards**: Rejects excess concurrent requests with `503 SERVER_BUSY` when connection limits are reached (`MAX_CONCURRENT_RESOLVE` and `MAX_CONCURRENT_DOWNLOAD`).
- **Memory Bounded In-Memory Stores**:
  - `RateLimitService`: Automatically purges expired IP records and caps active entries at 20,000 to guarantee zero memory leaks.
  - `DownloadTokenService`: Evicts expired tokens and caps stored tokens at 10,000.
- **Streaming Transfer Engine**: Directly streams upstream media using Node.js `Readable.fromWeb` and a custom `StreamSizeLimitTransform` to enforce the 500 MB maximum transfer limit without buffering media in server memory or writing to disk.

### 1.3 Media Extraction Layer (Python FastAPI + yt-dlp)
- **Bounded Concurrency**: Uses an `asyncio.Semaphore` to cap concurrent extraction jobs.
- **Non-Blocking Threadpool**: Uses `asyncio.to_thread` for `yt-dlp` operations, preventing event loop blocking.
- **Disk Protection**: `cachedir: False` prevents write spikes or cache fragmentation on container disks.
- **Standardized Error Handling**: Maps extraction outcomes to deterministic, user-friendly error codes (`PROVIDER_AUTH_ERROR`, `PRIVATE_CONTENT`, `MEDIA_NOT_FOUND`, `PROVIDER_RATE_LIMITED`).

---

## 2. Operational Runbook & Troubleshooting

### Issue 1: High Memory Usage
- **Root Cause Analysis**: Check active streaming downloads (`activeDownloads`).
- **Remediation**:
  - Confirm streaming is bypassing disk write.
  - Scale horizontal container instances if traffic exceeds 50 concurrent downloads per container.
  - Lower `MAX_MEDIA_SIZE_BYTES` or `MAX_CONCURRENT_DOWNLOAD`.

### Issue 2: Extractor Unresponsive (`/ready` returns 503)
- **Root Cause Analysis**: Python worker process may have died or stalled on an upstream network request.
- **Remediation**:
  - In local/single-container mode, verify `pythonProcess` is alive.
  - In multi-container microservice setups, inspect the Python service logs.
  - Verify network outbound access to `instagram.com` and upstream CDN hosts.

### Issue 3: Instagram Upstream Throttling (`PROVIDER_RATE_LIMITED`)
- **Root Cause Analysis**: Instagram blocks or throttles extraction IP after excessive automated queries.
- **Remediation**:
  - Use residential proxies or IP rotation on the extractor service if operating at high volume.
  - Increase `RATE_LIMIT_MAX_REQUESTS` threshold to restrict per-user abuse.
  - Cache identical URL resolutions for a short window (e.g., 5 minutes) if traffic is concentrated on viral links.
