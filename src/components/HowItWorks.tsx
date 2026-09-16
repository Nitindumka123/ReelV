import React from 'react';
import { motion } from 'motion/react';

export const HowItWorks = () => {
  const steps = [
    {
      number: '01',
      title: 'Paste',
      description: 'Paste your public Instagram Reel, Story, or Highlight link into the input above.'
    },
    {
      number: '02',
      title: 'Process',
      description: 'Our system instantly resolves the publicly accessible media assets for you.'
    },
    {
      number: '03',
      title: 'Download',
      description: 'Download the highest-quality media file directly to your device.'
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">How it Works</h2>
          <p className="text-secondary-text max-w-2xl mx-auto">
            Experience the simplest way to access public Instagram media. No login required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative p-8 bg-surface border border-border-subtle rounded-2xl group hover:border-primary-red/30 transition-all"
            >
              <div className="text-5xl font-black text-primary-red/10 mb-6 group-hover:text-primary-red/20 transition-colors">{step.number}</div>
              <h3 className="text-xl font-bold mb-3">{step.title}</h3>
              <p className="text-secondary-text text-sm leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
