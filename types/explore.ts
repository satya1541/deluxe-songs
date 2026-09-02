export type AudioSourcePlatform = 'jiosaavn' | 'youtube' | 'soundcloud';

export interface SourceBadge {
  name: string;
  icon: string;
  logoUrl?: string;
  color: string;
  bg: string;
  border: string;
  qualityLabel: string;
}

export interface CanonicalEntityBase {
  id: string;
  name: string;
  cover: string;
  source: AudioSourcePlatform | 'mixed';
}

export interface CanonicalArtist extends CanonicalEntityBase {
  type: 'artist';
  role?: string;
}

export interface CanonicalAlbum extends CanonicalEntityBase {
  type: 'album';
  artist: string;
  year?: string;
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
  rankingMode?: import('./recommendation').RankingMode;
}

export interface CanonicalSong extends ExploreSong {
  type: 'song';
  fallbackSources?: Array<{
    source: AudioSourcePlatform;
    id: string;
    streamUrl: string;
    quality: string;
    sourceBadge?: SourceBadge;
  }>;
}

export interface ExploreSearchResult {
  topResult?: CanonicalArtist | CanonicalAlbum | CanonicalSong;
  songs: CanonicalSong[];
  artists: CanonicalArtist[];
  albums: CanonicalAlbum[];
  correctedQuery?: string;
  intent?: { primary: string; confidence: number };
}

export interface LanguageOption {
  id: string;
  name: string;
  icon: string;
  queryHint: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
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
  { id: 'odia', name: 'Odia', icon: '🕉️', queryHint: 'Odia Chartbusters' },
];
