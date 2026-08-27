export type AudioSourcePlatform = 'jiosaavn' | 'youtube' | 'soundcloud';

export interface SourceBadge {
  name: 'JioSaavn' | 'YouTube Music' | 'SoundCloud';
  icon: string;
  color: string;
  bg: string;
  border: string;
  qualityLabel: string;
}

export interface ExploreSong {
  id: string;
  name: string;
  artist: string;
  album: string;
  year?: string;
  duration: number; // in seconds
  cover: string; // 500x500 high-res cover art
  streamUrl: string; // direct 320kbps / high-quality media url
  quality: '320kbps' | '160kbps' | '128kbps' | '96kbps';
  source?: AudioSourcePlatform;
  sourceBadge?: SourceBadge;
  language?: string;
  hasLyrics?: boolean;
}

export interface LanguageOption {
  id: string;
  name: string;
  icon: string;
  queryHint: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { id: 'all', name: 'All / Global', icon: '🌍', queryHint: 'Top Global Hits' },
  { id: 'hindi', name: 'Hindi', icon: '🇮🇳', queryHint: 'Trending Hindi Bollywood' },
  { id: 'punjabi', name: 'Punjabi', icon: '⚡', queryHint: 'Top Punjabi Hits' },
  { id: 'english', name: 'English', icon: '✨', queryHint: 'Billboard Hot 100' },
  { id: 'tamil', name: 'Tamil', icon: '🔥', queryHint: 'Tamil Chartbusters Anirudh' },
  { id: 'telugu', name: 'Telugu', icon: '🌟', queryHint: 'Telugu Top Hits' },
  { id: 'bhojpuri', name: 'Bhojpuri', icon: '🎉', queryHint: 'Bhojpuri Hit Songs' },
  { id: 'bengali', name: 'Bengali', icon: '🎶', queryHint: 'Bengali Hits Arijit' },
  { id: 'malayalam', name: 'Malayalam', icon: '🌴', queryHint: 'Malayalam Melodies' },
  { id: 'kannada', name: 'Kannada', icon: '💫', queryHint: 'Kannada Chartbusters' },
  { id: 'marathi', name: 'Marathi', icon: '🥁', queryHint: 'Marathi Hits Ajay Atul' },
  { id: 'gujarati', name: 'Gujarati', icon: '🪕', queryHint: 'Gujarati Garba & Hits' },
  { id: 'haryanvi', name: 'Haryanvi', icon: '🚀', queryHint: 'Haryanvi Ragni & Beats' },
];
