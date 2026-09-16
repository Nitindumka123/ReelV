# ReelVault — Security Architecture & Threat Model

ReelVault adheres to strict security, privacy, and architectural guidelines designed to prevent exploitation, resource exhaustion, data leaks, and server-side request forgery (SSRF).

---

## 1. Ethical & Compliance Boundaries

1. **Public Content Only**: ReelVault exclusively processes publicly available Instagram media that does not require login credentials.
2. **Zero Credential Collection**: The service never prompts for, stores, or transmits Instagram usernames, passwords, session cookies, or 2FA tokens.
3. **No DRM Circumvention**: The application does not bypass DRM, anti-bot mechanisms, or private account privacy protections.
4. **No Simulated Success**: If an item cannot be resolved or is private, the application surfaces clear, transparent error notifications rather than faking metadata.

---

## 2. Server-Side Request Forgery (SSRF) Protection

All inbound URLs and upstream media destinations undergo rigorous multi-stage validation in `SecurityService`:

### Initial Resolution Protection (`validateForSSRF`)
- **Protocol Restriction**: Strict `https:` only. Plain `http:` is rejected immediately.
- **Port Restriction**: Standard port `443` or default port only. Custom ports (e.g., `:8080`, `:22`) are rejected.
- **Userinfo Rejection**: URLs with credentials (e.g., `https://user:pass@domain.com`) are rejected to prevent basic auth smuggling.
- **Host Normalization**: Canonicalizes hostnames, removes trailing dots, and rejects punycode (`xn--`).
- **Internal & Private IP Defense**: Rejects all internal network addresses:
  - Loopback (`127.0.0.0/8`, `localhost`, `[::1]`)
  - Cloud Metadata Services (`169.254.169.254`, `169.254.0.0/16`)
  - RFC 1918 Private Networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  - Hexadecimal, octal, or integer-encoded representations of IP addresses.
- **Strict Domain Allowlist**: Only permits `instagram.com`, `www.instagram.com`, and `m.instagram.com`.

### Upstream Media & Redirect Validation (`validateUpstreamUrl`)
- Media destinations returned by the extractor must match approved Meta CDN domains:
  - `instagram.com`
  - `cdninstagram.com`
  - `fbcdn.net`
- If an upstream server responds with a redirect (`301`, `302`, `307`, etc.), the redirect `Location` header is parsed and validated against the same rules before being followed.

---

## 3. Ephemeral Download Token Architecture

Direct CDN media URLs are never exposed to the client browser. Instead:
1. When media is resolved, a cryptographically secure, 64-character hexadecimal token is generated using Node.js `crypto.randomBytes(32)`.
2. The token is mapped in-memory with a configurable Time-To-Live (TTL, default: 1 hour).
3. The client receives a proxy URL: `/api/download?token=<token>`.
4. Filenames are strictly sanitized to alphanumeric characters with approved extensions (`mp4`, `mov`, `jpg`, `png`, `webp`).
5. Once a token expires or capacity is reached, it is evicted from memory.

---

## 4. Streaming Resource & Memory Protection

- **No Server Buffering**: Media is piped directly from upstream web streams to the HTTP response (`Readable.fromWeb(body).pipe(sizeLimiter).pipe(res)`). The server never buffers video files in RAM or writes them to disk.
- **Streaming Byte Counter**: Even if the upstream server omits the `Content-Length` header or sends chunked transfer encoding, `StreamSizeLimitTransform` monitors transferred bytes and terminates the stream if it exceeds `MAX_MEDIA_SIZE_BYTES` (500 MB).
- **Client Disconnect Handling**: Express listens for client disconnection (`req.on('close')`) and aborts the upstream fetch request via `AbortController`, preventing orphan requests from draining network bandwidth.

---

## 5. Defense Against Denial of Service (DoS)

- **Rate Limiting**: In-memory IP tracking with automatic expiry and bounded store capacity (max 20,000 IPs).
- **Active Concurrency Caps**: Concurrency semaphores prevent CPU starvation and socket pool exhaustion.
- **Payload Size Limits**: JSON request bodies are capped at `1mb` to prevent memory flooding.
