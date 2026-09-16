import React from 'react';
import { motion } from 'motion/react';

export const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <motion.a 
              href="/"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl font-bold tracking-tighter flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-primary-red rounded-sm flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-full"></div>
              </div>
              <span className="text-white">Reel<span className="text-primary-red">Vault</span></span>
            </motion.a>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#how-it-works" className="text-sm font-medium text-secondary-text hover:text-white transition-colors">How it works</a>
            <a href="#supported" className="text-sm font-medium text-secondary-text hover:text-white transition-colors">Supported Media</a>
            <a href="#faq" className="text-sm font-medium text-secondary-text hover:text-white transition-colors">FAQ</a>
          </div>

          <div className="flex items-center">
            <button className="bg-surface border border-border-subtle px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors">
              Support
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
