import React from 'react';
import { motion } from 'motion/react';
import { Play, Camera, Heart } from 'lucide-react';

export const SupportedMedia = () => {
  const categories = [
    {
      title: 'Reels',
      description: 'Short-form Instagram videos in their original high quality.',
      icon: Play
    },
    {
      title: 'Stories',
      description: 'Publicly accessible Instagram stories where supported.',
      icon: Camera
    },
    {
      title: 'Highlights',
      description: 'Publicly accessible highlight media from profile collections.',
      icon: Heart
    }
  ];

  return (
    <section id="supported" className="py-24 bg-secondary-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Supported Media</h2>
            <p className="text-secondary-text">
              We focus on the most popular Instagram formats to ensure the highest reliability and quality for every download.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-surface border border-border-subtle px-4 py-2 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Systems Online</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {categories.map((category, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="p-10 bg-surface border border-border-subtle rounded-3xl hover:bg-white/5 transition-all cursor-default"
            >
              <div className="w-12 h-12 bg-primary-red/10 rounded-xl flex items-center justify-center mb-8">
                <category.icon className="text-primary-red w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold mb-4">{category.title}</h3>
              <p className="text-secondary-text text-sm leading-relaxed mb-6">
                {category.description}
              </p>
              <div className="flex items-center gap-2 text-primary-red text-xs font-bold uppercase tracking-wider">
                Learn more 
                <span className="text-lg">→</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
