import React from 'react';
import { motion } from 'motion/react';
import { MediaMetadata } from '../types';
import { Download, Film, Share2, Maximize2, ShieldCheck } from 'lucide-react';

interface MediaPreviewProps {
  media: MediaMetadata;
  key?: React.Key;
}

export const MediaPreview = ({ media }: MediaPreviewProps) => {
  const resolution = media.width && media.height ? `${media.width} × ${media.height}` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto mt-12 bg-surface border border-border-subtle rounded-2xl overflow-hidden red-glow"
    >
      <div className="flex flex-col md:flex-row">
        <div className="relative w-full md:w-64 aspect-[9/16] bg-black">
          <img 
            src={media.thumbnail} 
            alt="Media preview" 
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent"></div>
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
                  <div className="font-bold">{media.size || 'Auto'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <a 
              href={media.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full bg-primary-red hover:bg-bright-red text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 group"
            >
              <Download size={20} className="group-hover:scale-110 transition-transform" />
              Download Media
            </a>
            <div className="flex items-center gap-2">
              <button className="flex-1 bg-surface border border-border-subtle hover:bg-white/5 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm">
                <Share2 size={16} />
                Share
              </button>
              <button className="flex-1 bg-surface border border-border-subtle hover:bg-white/5 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm">
                <Maximize2 size={16} />
                Full Preview
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
