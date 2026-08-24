export function cleanTitle(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\.(mp3|wav|m4a|ogg|flac|aac)$/i, '')
    .replace(/\s*[-–—:]?\s*(PagalNew|PagalWorld|PagalSongs|SongsPk|DjPunjab|Mp3Tau|PenduJatt|KoshalWorld|OdiaBazar|RiskyjaTT|NaaSongs|MrJatt|DJMaza|Hungama|Gaana|JioSaavn)(\.Com(\.Se)?)?/gi, '')
    .replace(/\b(320|128|192|256)\s*kbps\b/gi, '')
    .replace(/\b(mp3|audio|song|track|download|full audio|lyrical video|full video)\b/gi, '')
    .replace(/\([^)]*(Pagal|Jatt|World|Bazar|Songs|Music|Kbps|RingTone|Com)[^)]*\)/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s*[-–—]\s*$/, '')
    .replace(/^\s*[-–—]\s*/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanArtist(artist: string): string {
  if (!artist || artist === 'Unknown') return 'Unknown Artist';
  let cleaned = artist.replace(/\.(mp3|wav|ogg|m4a|flac)$/i, '');
  cleaned = cleaned.replace(/320 ?Kbps|128 ?Kbps|PagalNew|Pagalworld|Paglasongs|Songs?/gi, '');
  return cleaned.trim() || 'Unknown Artist';
}
