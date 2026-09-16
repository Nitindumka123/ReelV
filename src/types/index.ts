import { LucideIcon } from 'lucide-react';

export type MediaType = 'reel' | 'story' | 'highlight' | 'unknown';

export interface MediaMetadata {
  type: MediaType;
  url: string;
  thumbnail: string;
  mimeType: string;
  extension: string;
  width: number | null;
  height: number | null;
  duration: string | null;
  size: string | null;
  quality: string | null;
}

export interface ResolveResponse {
  success: boolean;
  media?: MediaMetadata;
  error?: {
    code: string;
    message: string;
  };
  requestId?: string;
}

export type DownloadState = 
  | 'idle' 
  | 'validating' 
  | 'resolving' 
  | 'success' 
  | 'error';

export type ErrorCode = 
  | 'INVALID_URL'
  | 'UNSUPPORTED_URL'
  | 'PRIVATE_CONTENT'
  | 'MEDIA_NOT_FOUND'
  | 'PROCESSING_FAILED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_RATE_LIMITED'
  | 'RATE_LIMITED'
  | 'SERVER_BUSY'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

export interface NavItem {
  label: string;
  href: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}
