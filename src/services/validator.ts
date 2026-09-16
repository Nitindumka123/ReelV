export const validateInstagramUrl = (url: string): boolean => {
  if (!url) return false;
  
  // Basic Instagram URL regex
  const instagramRegex = /^(https?:\/\/)?(www\.)?instagram\.com\/(reel|reels|stories|highlights|p)\/([A-Za-z0-9_-]+)/;
  return instagramRegex.test(url);
};

export const getMediaTypeFromUrl = (url: string): string => {
  if (url.includes('/reel/') || url.includes('/reels/')) return 'reel';
  if (url.includes('/stories/')) return 'story';
  if (url.includes('/highlights/')) return 'highlight';
  if (url.includes('/p/')) return 'post';
  return 'unknown';
};
