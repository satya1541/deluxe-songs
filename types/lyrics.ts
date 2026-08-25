export interface LyricLine {
  time: number; // in seconds (e.g. 14.52)
  text: string;
}

export interface LyricsData {
  synced: boolean;
  lines: LyricLine[];
  plainLyrics?: string;
  source?: 's3_cache' | 'lrclib' | 'netease' | 'studio_verified_lrc' | 'none';
}
