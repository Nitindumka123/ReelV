import React from 'react';
import { motion } from 'motion/react';
import { Loader2, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { DownloadState, ErrorCode } from '../types';

interface StatusMessageProps {
  state: DownloadState;
  error?: ErrorCode | string | { code: string; message?: string };
  key?: React.Key;
}

export const StatusMessage = ({ state, error }: StatusMessageProps) => {
  if (state === 'idle') return null;

  const errorCode = typeof error === 'object' ? error.code || '' : error || '';
  const customMessage = typeof error === 'object' ? error.message : undefined;

  const getErrorMessage = (code: string) => {
    switch (code) {
      case 'INVALID_URL': return { title: 'Invalid Instagram Link', desc: 'Please check the URL and try again.' };
      case 'UNSUPPORTED_URL': return { title: 'Unsupported Media', desc: 'This type of content is not yet supported.' };
      case 'PRIVATE_CONTENT': return { title: 'Private Account Restricted', desc: 'We cannot process media from private accounts.' };
      case 'MEDIA_NOT_FOUND': return { title: 'Media Not Found', desc: 'The content might have been deleted or moved.' };
      case 'RATE_LIMITED': return { title: 'Too Many Requests', desc: 'Please wait a moment before trying again.' };
      case 'TIMEOUT': return { title: 'Request Timeout', desc: 'The processing took too long. Please try again.' };
      case 'PROVIDER_UNAVAILABLE': return { title: 'Provider Offline', desc: 'Our resolution service is temporarily unavailable.' };
      case 'PROVIDER_NOT_CONFIGURED': return { title: 'Service Not Configured', desc: 'The media provider credentials are not set.' };
      case 'PROVIDER_AUTH_ERROR': return { title: 'Access Restricted', desc: customMessage || 'Instagram requires authentication or blocked the automated request.' };
      case 'PROVIDER_RATE_LIMITED': return { title: 'Provider Rate Limited', desc: 'The provider has reached its capacity. Please try again later.' };
      default: return { title: 'Processing Error', desc: customMessage || 'An unexpected error occurred during processing.' };
    }
  };

  const errorDetails = state === 'error' && errorCode ? getErrorMessage(errorCode) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      role="status"
      aria-live="polite"
      className="mt-8 flex justify-center"
    >
      {state === 'validating' && (
        <div className="flex items-center gap-3 text-secondary-text">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Checking link format...</span>
        </div>
      )}

      {state === 'resolving' && (
        <div className="flex items-center gap-3 text-primary-red">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-bold tracking-tight">Resolving media assets...</span>
        </div>
      )}

      {state === 'error' && errorDetails && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 px-6 py-4 rounded-xl">
          {errorCode === 'PRIVATE_CONTENT' ? (
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          )}
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold text-red-500">{errorDetails.title}</span>
            <span className="text-xs text-secondary-text">{errorDetails.desc}</span>
          </div>
        </div>
      )}

      {state === 'success' && (
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-bold uppercase tracking-widest">Media Resolved</span>
        </div>
      )}
    </motion.div>
  );
};
