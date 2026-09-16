import React, { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar } from './components/Navbar';
import { UrlInput } from './components/UrlInput';
import { StatusMessage } from './components/StatusMessage';
import { MediaPreview } from './components/MediaPreview';
import { Footer } from './components/Footer';
import { DownloadState, MediaMetadata, ErrorCode } from './types';
import { validateInstagramUrl } from './services/validator';
import { resolveMedia } from './services/api';

const HowItWorks = React.lazy(() => import('./components/HowItWorks').then(m => ({ default: m.HowItWorks })));
const SupportedMedia = React.lazy(() => import('./components/SupportedMedia').then(m => ({ default: m.SupportedMedia })));
const FAQ = React.lazy(() => import('./components/FAQ').then(m => ({ default: m.FAQ })));

export default function App() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<DownloadState>('idle');
  const [media, setMedia] = useState<MediaMetadata | null>(null);
  const [error, setError] = useState<ErrorCode | string | { code: string; message?: string } | undefined>();

  const handleSubmit = async () => {
    if (!url) return;

    setError(undefined);
    setMedia(null);
    setState('validating');

    // Step 1: Client-side Validation (fast feedback)
    const isValid = validateInstagramUrl(url);
    if (!isValid) {
      setTimeout(() => {
        setState('error');
        setError('INVALID_URL');
      }, 500);
      return;
    }

    // Step 2: Backend Processing
    setState('resolving');
    try {
      const result = await resolveMedia(url);
      setState('success');
      setMedia(result);
    } catch (err: any) {
      setState('error');
      setError({
        code: err.code || 'INTERNAL_ERROR',
        message: err.message
      });
    }
  };

  const handleClear = () => {
    setUrl('');
    setState('idle');
    setMedia(null);
    setError(undefined);
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-primary-red selection:text-white">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-32 pb-24 md:pt-48 md:pb-40 overflow-hidden">
          {/* Ambient Lighting */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl aspect-square bg-primary-red/5 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute -bottom-40 left-0 w-96 h-96 bg-primary-red/10 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-6 leading-[0.9]">
                Download Instagram Media.<br />
                <span className="text-primary-red">Fast. Simple. High Quality.</span>
              </h1>
              <p className="text-secondary-text text-lg md:text-xl max-w-2xl mx-auto mb-12 font-medium">
                Paste a public Instagram link and get the highest-quality media available instantly.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <UrlInput 
                value={url}
                onChange={setUrl}
                onClear={handleClear}
                onSubmit={handleSubmit}
                disabled={state === 'validating' || state === 'processing'}
              />
            </motion.div>

            <AnimatePresence mode="wait">
              <StatusMessage key="status" state={state} error={error} />
            </AnimatePresence>

            <AnimatePresence>
              {media && state === 'success' && (
                <MediaPreview key="preview" media={media} />
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Content Sections */}
        <Suspense fallback={<div className="h-40"></div>}>
          <HowItWorks />
          <SupportedMedia />
          <FAQ />
        </Suspense>

        {/* Trust Section */}
        <section className="py-20 bg-secondary-background border-y border-border-subtle">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <div className="text-2xl font-bold text-white">No Login</div>
                <p className="text-secondary-text text-sm">Your credentials are never requested.</p>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-white">Zero Trackers</div>
                <p className="text-secondary-text text-sm">We value your privacy and security.</p>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-white">Public Only</div>
                <p className="text-secondary-text text-sm">Strictly authorized media processing.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

