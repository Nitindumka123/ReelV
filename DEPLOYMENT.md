# ReelVault — Production Deployment Guide

This guide details the complete production deployment architecture for **ReelVault**, covering Cloudflare edge configuration, DNS, HTTPS, CORS, caching rules, and containerized backend hosting.

---

## 1. High-Level Architecture Overview

ReelVault consists of two core layers:
1. **Frontend**: Modern React + Vite application (compiled to static production assets in `dist/`).
2. **Backend Services**:
   - **API Gateway / Server**: Node.js + Express (`server.ts`, compiled to `dist/server.cjs`).
   - **Extractor Engine**: Python FastAPI microservice utilizing `yt-dlp` (`fastapi_app.py`).

```
[ User Browser ]
       │ (HTTPS)
       ▼
[ Cloudflare Edge / WAF / DNS / SSL Termination ]
       │
       ├──► Static Assets (HTML, CSS, JS, Images, Webmanifest)
       │    Cached at Cloudflare Edge (Cache-Control: public, max-age=31536000, immutable)
       │
       └──► API Routes (/api/resolve, /api/download, /health, /ready)
            Proxied to Container / VM Backend (Bypass Cache, Stream direct)
                  │
                  ▼
            [ Express Server (Port 3000) ]
                  │
                  ├── Rate Limiting & Concurrency Controls
                  ├── SSRF & Host Validation
                  ├── Ephemeral Download Token Store
                  │
                  └──► [ Python Extractor (Port 3001) ] (yt-dlp)
```

> **Important Runtime Note**: Cloudflare Workers / Pages Functions run on V8 isolates and **do not support native Python runtimes or child process execution**. Therefore, the Python/yt-dlp extractor must be hosted in an environment that supports Python (e.g., Google Cloud Run, Fly.io, Railway, AWS ECS, or a Linux VPS). The Express backend can run alongside it or point to it via `EXTRACTOR_URL`.

---

## 2. Cloudflare Configuration

### A. DNS & SSL/TLS
1. **DNS Records**:
   - Add an `A` or `CNAME` record pointing your domain (e.g., `reelvault.app`) to your container host or reverse proxy.
   - Ensure the orange cloud (**Proxied**) is enabled.
2. **SSL/TLS Mode**:
   - Set encryption mode to **Full (strict)**.
   - Enable **Always Use HTTPS** and **Automatic HTTPS Rewrites**.
   - Set **Minimum TLS Version** to `TLS 1.2` or `TLS 1.3`.

### B. Caching Rules
Configure Cloudflare Page Rules or Cache Rules:
1. **Static Assets (`/assets/*`, `/site.webmanifest`, `/vite.svg`)**:
   - **Cache Level**: Cache Everything
   - **Edge Cache TTL**: 1 month to 1 year
   - **Browser Cache TTL**: 1 month to 1 year
2. **API Endpoints (`/api/*`, `/ready`, `/health`)**:
   - **Cache Level**: Bypass Cache (Never Cache)
   - *Note*: The backend already sends `Cache-Control: no-store, no-cache, must-revalidate, private` and `X-Accel-Buffering: no` on these routes.

### C. WAF & Security Rules
- Enable **Bot Fight Mode** to mitigate automated scrapers and abuse.
- Enable **Cloudflare Rate Limiting** on `/api/resolve` (e.g., 20 requests per minute per IP) as a first-line defense before requests reach the origin.
- Set up IP reputation checks on API routes.

---

## 3. Environment Variables

Configure the following environment variables in your production environment:

| Variable | Description | Recommended Production Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Node server listening port | `3000` |
| `APP_URL` | Canonical public application URL | `https://reelvault.app` |
| `ALLOWED_ORIGINS` | Permitted CORS origins | `https://reelvault.app,https://www.reelvault.app` |
| `EXTRACTOR_URL` | Endpoint of the Python extractor | `http://127.0.0.1:8000` (or internal microservice URL) |
| `EXTRACTOR_HEALTH_URL` | Extractor health endpoint | `http://127.0.0.1:8000/health` |
| `EXTRACTOR_TIMEOUT_MS` | Max time allowed for extraction | `120000` (120 seconds) |
| `EXTRACTOR_MAX_CONCURRENCY` | Max simultaneous yt-dlp threads | `2` |
| `MAX_CONCURRENT_RESOLVE` | Max simultaneous resolve requests | `3` |
| `MAX_CONCURRENT_DOWNLOAD` | Max simultaneous streaming downloads | `2` |
| `MAX_MEDIA_SIZE_BYTES` | Maximum media download file size | `524288000` (500 MB) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit duration in ms | `60000` (1 minute) |
| `RATE_LIMIT_MAX_REQUESTS` | Max resolve requests per IP per min | `10` |
| `DOWNLOAD_RATE_LIMIT_MAX` | Max download streams per IP per min | `10` |
| `TOKEN_TTL_MS` | Ephemeral download token lifespan | `3600000` (1 hour) |
| `MAX_ACTIVE_TOKENS` | In-memory token cache capacity | `10000` |

---

## 4. Docker & Container Deployment

### Dockerfile (Multi-stage Production Build)
```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.11-slim AS runner
WORKDIR /app

# Install Node.js runtime and system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
RUN pip install --no-cache-dir fastapi uvicorn yt-dlp pydantic

# Copy production artifacts
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY fastapi_app.py ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start server
CMD ["node", "dist/server.cjs"]
```

---

## 5. Health & Readiness Monitoring

The service exposes production probes for Kubernetes, Cloud Run, or uptime monitoring:

- **Liveness Probe**: `GET /health`
  - Returns `200 OK` with `{ status: "ok", uptime: <seconds> }` when the Node.js process is active.
- **Readiness Probe**: `GET /ready`
  - Returns `200 OK` with `{ status: "ready", provider: "ok" }` when both the Express server and the Python extractor are healthy.
  - Returns `503 Service Unavailable` if the extractor is unresponsive or starting up.
