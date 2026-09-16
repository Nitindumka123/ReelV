#!/usr/bin/env python3
"""
ReelVault Python yt-dlp Extraction Microservice
Provides /health and /extract HTTP endpoints using standard library HTTP server.
Compatible with standard Python 3.8+ runtimes without requiring external pip dependencies.
"""

import sys
import os
import json
import subprocess
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PORT = int(os.environ.get("EXTRACTOR_PORT", "8000"))
HOST = os.environ.get("EXTRACTOR_HOST", "127.0.0.1")
MAX_CONCURRENCY = int(os.environ.get("EXTRACTOR_MAX_CONCURRENCY", "2"))
TIMEOUT_SECONDS = int(os.environ.get("EXTRACTOR_TIMEOUT_MS", "60000")) // 1000

concurrency_semaphore = threading.BoundedSemaphore(MAX_CONCURRENCY)

def find_ytdlp_executable():
    """Finds yt-dlp executable path."""
    candidates = [
        os.path.join(os.getcwd(), "yt-dlp-bin"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "yt-dlp-bin"),
        "/usr/local/bin/yt-dlp",
        "/usr/bin/yt-dlp",
        "yt-dlp"
    ]
    for c in candidates:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return "yt-dlp"

YTDLP_BIN = find_ytdlp_executable()

def extract_media_ytdlp(url: str):
    """Executes yt-dlp to extract Instagram media."""
    acquired = concurrency_semaphore.acquire(blocking=True, timeout=10.0)
    if not acquired:
        return {
            "success": False,
            "status_code": 503,
            "error": {
                "code": "PROVIDER_UNAVAILABLE",
                "message": "Extractor service is busy processing other requests."
            }
        }

    proc = None
    try:
        cmd = [
            YTDLP_BIN,
            "--no-warnings",
            "--dump-json",
            "--no-playlist",
            "--socket-timeout", "15",
            url
        ]

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        try:
            stdout, stderr = proc.communicate(timeout=TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            proc.kill()
            stdout, stderr = proc.communicate()
            return {
                "success": False,
                "status_code": 504,
                "error": {
                    "code": "TIMEOUT",
                    "message": "Media extraction timed out."
                }
            }

        if proc.returncode != 0:
            err_msg = (stderr or stdout or "Unknown extraction failure").lower()
            if "private" in err_msg:
                return {
                    "success": False,
                    "status_code": 403,
                    "error": {
                        "code": "PRIVATE_CONTENT",
                        "message": "This Instagram content is private."
                    }
                }
            if "429" in err_msg or "too many requests" in err_msg or "rate-limit" in err_msg:
                return {
                    "success": False,
                    "status_code": 429,
                    "error": {
                        "code": "PROVIDER_RATE_LIMITED",
                        "message": "Instagram rate limit reached."
                    }
                }
            if "not found" in err_msg or "404" in err_msg or "deleted" in err_msg:
                return {
                    "success": False,
                    "status_code": 404,
                    "error": {
                        "code": "MEDIA_NOT_FOUND",
                        "message": "The requested media was not found or has been removed."
                    }
                }
            if "login" in err_msg or "empty media response" in err_msg or "checkpoint" in err_msg:
                return {
                    "success": False,
                    "status_code": 403,
                    "error": {
                        "code": "PROVIDER_AUTH_ERROR",
                        "message": "Instagram blocked the automated request or requires login."
                    }
                }

            return {
                "success": False,
                "status_code": 500,
                "error": {
                    "code": "PROCESSING_FAILED",
                    "message": "Failed to extract media from Instagram."
                }
            }

        data = json.loads(stdout)
        
        # Pick best progressive video format (with both video and audio)
        best_url = None
        best_width = None
        best_height = None
        formats = data.get("formats", [])

        # Filter progressive formats (contains both video and audio codec)
        progressive_formats = [
            f for f in formats 
            if f.get("vcodec") != "none" and f.get("acodec") != "none" and f.get("url")
        ]

        if progressive_formats:
            # Sort by width / height / resolution
            progressive_formats.sort(key=lambda f: (f.get("width") or 0) * (f.get("height") or 0))
            best = progressive_formats[-1]
            best_url = best.get("url")
            best_width = best.get("width")
            best_height = best.get("height")
        elif data.get("url"):
            best_url = data.get("url")
            best_width = data.get("width")
            best_height = data.get("height")
        elif data.get("requested_formats"):
            best_url = data["requested_formats"][0].get("url")
            best_width = data["requested_formats"][0].get("width")
            best_height = data["requested_formats"][0].get("height")

        if not best_url:
            return {
                "success": False,
                "status_code": 404,
                "error": {
                    "code": "MEDIA_NOT_FOUND",
                    "message": "No downloadable media stream found in post."
                }
            }

        thumbnail = data.get("thumbnail") or ""
        mime_type = "video/mp4" if (".mp4" in best_url or data.get("ext") == "mp4") else "image/jpeg"
        extension = "mp4" if mime_type == "video/mp4" else "jpg"

        media = {
            "url": best_url,
            "thumbnail": thumbnail,
            "width": best_width or data.get("width"),
            "height": best_height or data.get("height"),
            "title": data.get("title") or data.get("fulltitle") or "Instagram Media",
            "duration": data.get("duration"),
            "mimeType": mime_type,
            "extension": extension
        }

        return {
            "success": True,
            "status_code": 200,
            "media": media
        }

    except Exception as e:
        return {
            "success": False,
            "status_code": 500,
            "error": {
                "code": "PROCESSING_FAILED",
                "message": str(e)
            }
        }
    finally:
        concurrency_semaphore.release()


class ExtractorHTTPHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ["/health", "/", "/api/health"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            payload = {
                "status": "ok",
                "service": "reelvault-python-extractor",
                "ytdlp_bin": YTDLP_BIN
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path in ["/extract", "/api/extract"]:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 1024 * 1024:  # 1MB limit
                self.send_response(413)
                self.end_headers()
                return

            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                url = data.get("url")
            except Exception:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": {"code": "INVALID_URL", "message": "Invalid JSON request body."}
                }).encode("utf-8"))
                return

            if not url or "instagram.com" not in url:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": {"code": "INVALID_URL", "message": "Must be an Instagram URL."}
                }).encode("utf-8"))
                return

            result = extract_media_ytdlp(url)
            status_code = result.get("status_code", 200)
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            response_data = {
                "success": result["success"]
            }
            if result["success"]:
                response_data["media"] = result["media"]
            else:
                response_data["error"] = result["error"]

            self.wfile.write(json.dumps(response_data).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Quiet standard logging to avoid log noise, errors still handled
        pass

def run():
    server = HTTPServer((HOST, PORT), ExtractorHTTPHandler)
    print(f"ReelVault Extractor Service running on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    run()
