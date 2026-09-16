# ReelVault — Technical SEO & Core Web Vitals Report

This document outlines the search engine optimization (SEO), metadata, social sharing cards, and Core Web Vitals structure implemented for **ReelVault**.

---

## 1. Metadata & Open Graph Specification

- **Primary Page Title**: `Instagram Reel Downloader - Download Public Reels | ReelVault`
- **Meta Description**: `Download public Instagram Reels, Stories, and videos in high quality. Fast, free, and secure extraction with ReelVault.`
- **Canonical URL**: `https://reelvault.app/`
- **Open Graph (Facebook/LinkedIn)**:
  - `og:type`: `website`
  - `og:url`: `https://reelvault.app/`
  - `og:title`: Matches page title
  - `og:description`: Matches meta description
  - `og:image`: `https://reelvault.app/og-image.jpg`
- **Twitter Card**:
  - `twitter:card`: `summary_large_image`
  - `twitter:title`: Matches page title
  - `twitter:description`: Matches meta description
  - `twitter:image`: `https://reelvault.app/og-image.jpg`

---

## 2. Schema.org JSON-LD Structured Data

Implemented inside `<head>` in `index.html`:
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "ReelVault",
  "applicationCategory": "MultimediaApplication",
  "operatingSystem": "All",
  "description": "Download public Instagram Reels, Stories, and videos in high quality without compromising your security. No login, no trackers.",
  "url": "https://reelvault.app/",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "featureList": [
    "Public Instagram Reel Download",
    "Public Instagram Story Download",
    "High Quality Video Resolution",
    "Direct Streaming Download",
    "Zero Account Login Required"
  ]
}
```

---

## 3. Crawler Directives (`robots.txt` & `sitemap.xml`)

### `public/robots.txt`
```txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /health
Disallow: /ready
Sitemap: https://reelvault.app/sitemap.xml
```
- **Allow `/`**: Permits search engines to crawl all public landing content, FAQs, and documentation.
- **Disallow `/api/`, `/health`, `/ready`**: Prevents search engine indexing of backend API routes and health checks.

### `public/sitemap.xml`
- Declares the canonical root URL with `<changefreq>weekly</changefreq>` and `<priority>1.0</priority>`.

---

## 4. Core Web Vitals & Performance Strategy

1. **Largest Contentful Paint (LCP)**:
   - Critical hero text and CTA elements are rendered immediately in the initial bundle.
   - Secondary content (`HowItWorks`, `SupportedMedia`, `FAQ`) is code-split and lazy-loaded via `React.lazy` and `Suspense`.
2. **Cumulative Layout Shift (CLS)**:
   - Fixed height containers and reserved layout space for interactive elements prevent unexpected layout shifts during URL entry and validation.
3. **First Input Delay (FID) / Interaction to Next Paint (INP)**:
   - Lightweight event listeners on the URL input.
   - Minimal client-side JavaScript execution, using native CSS transitions and hardware-accelerated Framer Motion animations.
