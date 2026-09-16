import React from 'react';

export const Footer = () => {
  return (
    <footer className="py-12 border-t border-border-subtle bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4 max-w-xs">
            <div className="text-2xl font-bold tracking-tighter flex items-center gap-2">
              <div className="w-6 h-6 bg-primary-red rounded-sm flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
              <span className="text-white">Reel<span className="text-primary-red">Vault</span></span>
            </div>
            <p className="text-sm text-secondary-text">
              Fast, secure, and premium access to publicly available Instagram media assets.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-white">Product</h4>
              <ul className="space-y-2 text-sm text-secondary-text">
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How it works</a></li>
                <li><a href="#supported" className="hover:text-white transition-colors">Supported Media</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-white">Legal</h4>
              <ul className="space-y-2 text-sm text-secondary-text">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookies</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-white">Contact</h4>
              <ul className="space-y-2 text-sm text-secondary-text">
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border-subtle flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-secondary-text">
            © {new Date().getFullYear()} ReelVault. All rights reserved. Not affiliated with Instagram or Meta.
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-text">API Status: Optimal</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
