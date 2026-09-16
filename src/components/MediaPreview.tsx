import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MediaMetadata } from '../types';
import { Download, Film, Share2, Maximize2, ShieldCheck, Check, X } from 'lucide-react';

interface MediaPreviewProps {
  media: MediaMetadata;
  key?: React.Key;
}

export const MediaPreview = ({ media }: MediaPreviewProps) => {
  const [copied, setCopied] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [imgError, setImgError] = useState(false);

  const resolution = media.width && media.height ? `${media.width} × ${media.height}` : null;
  const filename = `ReelVault_Instagram_${media.type || 'media'}.${media.extension || 'mp4'}`;

  const handleShare = async () => {
    const fullUrl = window.location.origin + media.url;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ReelVault - Instagram Media',
          text: 'Check out this Instagram media download via ReelVault',
          url: fullUrl,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl mx-auto mt-12 bg-surface border border-border-subtle rounded-2xl overflow-hidden red-glow"
      >
        <div className="flex flex-col md:flex-row">
          <div className="relative w-full md:w-64 aspect-[9/16] bg-black flex items-center justify-center">
            {media.thumbnail && !imgError ? (
              <img 
                src={media.thumbnail} 
                alt={media.title || "Instagram media preview"} 
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover opacity-80"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-secondary-text">
                <Film size={36} className="text-primary-red mb-2 opacity-80" />
                <span className="text-xs font-semibold">{media.title || 'Instagram Media'}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent pointer-events-none"></div>
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <div className="bg-primary-red p-1.5 rounded-sm">
                <Film size={14} className="text-white" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest">{media.type}</span>
            </div>
          </div>

          <div className="flex-1 p-6 flex flex-col justify-between text-left">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold tracking-tight">Media Found</h3>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <ShieldCheck size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Public Access</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background/50 border border-border-subtle rounded-lg p-3">
                    <div className="text-[10px] text-secondary-text uppercase font-bold tracking-wider mb-1">Quality</div>
                    <div className="font-bold">{media.quality || 'Available'}</div>
                  </div>
                  <div className="bg-background/50 border border-border-subtle rounded-lg p-3">
                    <div className="text-[10px] text-secondary-text uppercase font-bold tracking-wider mb-1">Resolution</div>
                    <div className="font-bold">{resolution || 'Standard'}</div>
                  </div>
                  <div className="bg-background/50 border border-border-subtle rounded-lg p-3">
                    <div className="text-[10px] text-secondary-text uppercase font-bold tracking-wider mb-1">Format</div>
                    <div className="font-bold uppercase">{media.extension || 'MP4'}</div>
                  </div>
                  <div className="bg-background/50 border border-border-subtle rounded-lg p-3">
                    <div className="text-[10px] text-secondary-text uppercase font-bold tracking-wider mb-1">Size</div>
                    <div className="font-bold">{media.size || 'Streamed'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <a 
                href={media.url} 
                download={filename}
                aria-label={`Download ${media.type} media file`}
                className="w-full bg-primary-red hover:bg-bright-red text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 group shadow-lg shadow-primary-red/20 active:scale-[0.98]"
              >
                <Download size={20} className="group-hover:scale-110 transition-transform" />
                Download Media
              </a>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleShare}
                  aria-label="Share media download link"
                  className="flex-1 bg-surface border border-border-subtle hover:bg-white/5 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
                >
                  {copied ? (
                    <>
                      <Check size={16} className="text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={16} />
                      Share
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setShowFullPreview(true)}
                  aria-label="Open full media preview player"
                  className="flex-1 bg-surface border border-border-subtle hover:bg-white/5 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
                >
                  <Maximize2 size={16} />
                  Full Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Full Preview Modal */}
      <AnimatePresence>
        {showFullPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-surface border border-border-subtle rounded-2xl overflow-hidden p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold">Media Preview</h4>
                <button
                  onClick={() => setShowFullPreview(false)}
                  aria-label="Close preview modal"
                  className="p-1.5 rounded-lg text-secondary-text hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="relative aspect-[9/16] max-h-[60vh] mx-auto bg-black rounded-xl overflow-hidden flex items-center justify-center">
                {media.extension === 'mp4' || media.type === 'reel' || media.type === 'story' ? (
                  <video 
                    src={media.url} 
                    controls 
                    playsInline 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img 
                    src={media.url} 
                    alt={media.title || "Full preview"} 
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <a
                  href={media.url}
                  download={filename}
                  aria-label="Download media from preview"
                  className="bg-primary-red hover:bg-bright-red text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors"
                >
                  <Download size={16} />
                  Download
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
