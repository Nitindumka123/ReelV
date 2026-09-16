import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, X, CornerDownLeft } from 'lucide-react';

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const UrlInput = ({ value, onChange, onClear, onSubmit, disabled }: UrlInputProps) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !disabled) {
      onSubmit();
    }
  };

  return (
    <div className="relative group w-full max-w-3xl mx-auto">
      <div className="absolute -inset-1 bg-primary-red/10 rounded-2xl blur-xl transition-all group-focus-within:bg-primary-red/20 group-focus-within:blur-2xl opacity-0 group-focus-within:opacity-100"></div>
      
      <div className="relative flex items-center bg-surface border border-border-subtle rounded-xl p-2 transition-all group-focus-within:border-primary-red/40 group-focus-within:ring-1 group-focus-within:ring-primary-red/40">
        <div className="pl-4 pr-3 text-secondary-text">
          <Link size={20} />
        </div>
        
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste Instagram Reel, Story or Highlight link..."
          className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-secondary-text py-3 text-lg"
          disabled={disabled}
        />

        <AnimatePresence>
          {value && !disabled && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={onClear}
              className="p-2 text-secondary-text hover:text-white transition-colors"
            >
              <X size={20} />
            </motion.button>
          )}
        </AnimatePresence>

        <button
          onClick={onSubmit}
          disabled={disabled || !value}
          className="hidden sm:flex items-center gap-2 bg-primary-red hover:bg-bright-red disabled:bg-surface disabled:text-secondary-text disabled:border-border-subtle text-white px-6 py-3 rounded-lg font-bold transition-all ml-2 border border-transparent shadow-lg shadow-primary-red/20 active:scale-95"
        >
          <span>Download</span>
          <CornerDownLeft size={16} className="opacity-50" />
        </button>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-6 text-[10px] uppercase tracking-widest font-bold text-secondary-text">
          <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-primary-red"></div> Reels</span>
          <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-primary-red"></div> Stories</span>
          <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-primary-red"></div> Highlights</span>
        </div>
        
        <div className="text-[11px] text-secondary-text/60 italic flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 border border-border-subtle rounded text-[9px] font-mono">CTRL + V</span>
          to paste
        </div>
      </div>
      
      {/* Mobile CTA */}
      <button
        onClick={onSubmit}
        disabled={disabled || !value}
        className="sm:hidden w-full mt-4 bg-primary-red hover:bg-bright-red disabled:bg-surface disabled:text-secondary-text text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-primary-red/20"
      >
        Download Now
      </button>
    </div>
  );
};
