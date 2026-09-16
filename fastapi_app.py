import sys
import os
import asyncio
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import yt_dlp
import logging
from typing import Optional

app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reelvault_extractor")

# Concurrency control to prevent CPU/memory exhaustion
MAX_CONCURRENCY = int(os.getenv("EXTRACTOR_MAX_CONCURRENCY", "2"))
semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

class ResolveRequest(BaseModel):
    url: str

class ExtractorResponse(BaseModel):
    success: bool
    media: Optional[dict] = None
    error: Optional[dict] = None

def _run_extraction(url: str):
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'dump_single_json': True,
        'extract_flat': False,
        'socket_timeout': 15,
        'cachedir': False,      # Do not cache to disk
        'no_color': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        return ydl.extract_info(url, download=False)

@app.post("/extract", response_model=ExtractorResponse)
async def extract_media(req: ResolveRequest):
    url = req.url
    
    # Bound concurrency with semaphore
    try:
        async with semaphore:
            # Run blocking extraction in a worker thread to keep event loop responsive
            info = await asyncio.to_thread(_run_extraction, url)
            
            # extract relevant fields
            media_url = info.get('url') or info.get('video_url')
            if not media_url and info.get('entries'):
                # Handle playlist/carousel
                entry = info['entries'][0]
                media_url = entry.get('url')
            
            if not media_url:
                raise Exception("Could not find media URL in extraction data")
                
            thumbnail = info.get('thumbnail')
            if not thumbnail and info.get('thumbnails'):
                thumbnail = info['thumbnails'][-1]['url']
                
            media_metadata = {
                'url': media_url,
                'thumbnail': thumbnail or '',
                'width': info.get('width'),
                'height': info.get('height'),
                'duration': info.get('duration'),
                'size': info.get('filesize') or info.get('filesize_approx'),
                'extension': info.get('ext') or 'mp4',
                'format': info.get('format')
            }
            
            return ExtractorResponse(success=True, media=media_metadata)
            
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        logger.error(f"yt-dlp download error: {error_msg}")
        
        # Parse error to provide structured feedback
        if "login" in error_msg.lower() or "logged-in" in error_msg.lower() or "not granting access" in error_msg.lower() or "empty media response" in error_msg.lower():
            return ExtractorResponse(success=False, error={"code": "PROVIDER_AUTH_ERROR", "message": "Instagram requires authentication or blocked the request."})
        elif "private" in error_msg.lower():
            return ExtractorResponse(success=False, error={"code": "PRIVATE_CONTENT", "message": "This content is private."})
        elif "not found" in error_msg.lower() or "404" in error_msg.lower():
            return ExtractorResponse(success=False, error={"code": "MEDIA_NOT_FOUND", "message": "Media not found."})
        elif "rate" in error_msg.lower() or "429" in error_msg.lower() or "too many requests" in error_msg.lower():
            return ExtractorResponse(success=False, error={"code": "PROVIDER_RATE_LIMITED", "message": "Instagram rate limited the extractor."})
        
        return ExtractorResponse(success=False, error={"code": "PROCESSING_FAILED", "message": str(e)})
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return ExtractorResponse(success=False, error={"code": "INTERNAL_ERROR", "message": "An unexpected error occurred during extraction."})

@app.get("/health")
def health_check():
    return {"status": "ok", "extractor": "yt-dlp"}

@app.get("/ready")
def readiness_check():
    return {"status": "ready", "extractor": "yt-dlp", "concurrency_limit": MAX_CONCURRENCY}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
