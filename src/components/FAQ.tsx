import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export const FAQ = () => {
  const faqs = [
    {
      question: "What links are supported?",
      answer: "ReelVault supports publicly accessible Instagram Reels, Stories, and Highlights. Simply copy the link from the Instagram app or website and paste it above."
    },
    {
      question: "Do I need an Instagram account?",
      answer: "No, you do not need an Instagram account or login to use ReelVault. We only process publicly available content that doesn't require authentication."
    },
    {
      question: "What quality will I receive?",
      answer: "We always attempt to fetch the highest possible resolution available for the provided link, typically 1080p for Reels and Stories."
    },
    {
      question: "Can I download private content?",
      answer: "No. ReelVault strictly respects privacy settings. We cannot and will not attempt to bypass private account restrictions or any other access controls."
    },
    {
      question: "Where are downloaded files stored?",
      answer: "Files are downloaded directly to your browser's default download location. On mobile, they are usually saved to your Gallery or Files app."
    },
    {
      question: "Why can't some links be processed?",
      answer: "Processing can fail if the account is private, the media has been deleted, or if there are temporary technical issues with Instagram's servers."
    }
  ];

  return (
    <section id="faq" className="py-24 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
          <p className="text-secondary-text">
            Everything you need to know about ReelVault.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem key={index} faq={faq} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

interface FAQItemProps {
  faq: {
    question: string;
    answer: string;
  };
  index: number;
  key?: React.Key;
}

const FAQItem = ({ faq }: FAQItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-border-subtle rounded-2xl overflow-hidden bg-surface transition-all hover:border-primary-red/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between text-left"
      >
        <span className="font-bold">{faq.question}</span>
        <ChevronDown 
          size={20} 
          className={`text-secondary-text transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 pb-6 text-sm text-secondary-text leading-relaxed border-t border-border-subtle/50 pt-4">
              {faq.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
