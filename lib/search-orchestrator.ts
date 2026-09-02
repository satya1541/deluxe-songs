import { ExploreSearchResult, CanonicalArtist, CanonicalAlbum, CanonicalSong } from '@/types/explore';
import { SearchIntent, ParsedQuery } from './search-parser';
import { normalizeQuery } from './search-parser';

export interface SectionOrdering {
  sections: Array<'TopResult' | 'Artists' | 'Albums' | 'Songs'>;
}

export function resolveTopResult(
  parsed: ParsedQuery,
  intent: SearchIntent,
  artists: CanonicalArtist[],
  albums: CanonicalAlbum[],
  songs: CanonicalSong[]
): CanonicalArtist | CanonicalAlbum | CanonicalSong | undefined {
  const normBase = parsed.normalizedBase;
  
  let bestArtist: CanonicalArtist | undefined;
  let bestAlbum: CanonicalAlbum | undefined;
  let bestSong: CanonicalSong | undefined;

  if (artists.length > 0) {
    bestArtist = artists.find(a => normalizeQuery(a.name) === normBase) || artists[0];
  }
  if (albums.length > 0) {
    bestAlbum = albums.find(a => normalizeQuery(a.name) === normBase) || albums[0];
  }
  if (songs.length > 0) {
    bestSong = songs.find(s => normalizeQuery(s.name) === normBase) || songs[0];
  }

  // 1. Intent overrides if confidence is high
  if (intent.confidence >= 0.8) {
    if (intent.requestedEntity === 'ARTIST' && bestArtist) return bestArtist;
    if (intent.requestedEntity === 'ALBUM' && bestAlbum) return bestAlbum;
    if (intent.requestedEntity === 'SONG' && bestSong) return bestSong;

    if (intent.primary === 'ARTIST' && bestArtist) return bestArtist;
    if (intent.primary === 'ALBUM' && bestAlbum) return bestAlbum;
    if (intent.primary === 'SONG' && bestSong) return bestSong;
  }

  // 2. Exact match check
  const isExactArtist = bestArtist && normalizeQuery(bestArtist.name) === normBase;
  const isExactAlbum = bestAlbum && normalizeQuery(bestAlbum.name) === normBase;
  const isExactSong = bestSong && normalizeQuery(bestSong.name) === normBase;

  if (isExactArtist && !isExactSong && !isExactAlbum) return bestArtist;
  if (isExactSong && !isExactArtist && !isExactAlbum) return bestSong;
  if (isExactAlbum && !isExactArtist && !isExactSong) return bestAlbum;

  // 3. Variant match
  if (parsed.variant && bestSong) {
    return bestSong;
  }

  // 4. Default heuristic fallback (prioritize Artists -> Songs -> Albums for generic matches)
  if (isExactArtist) return bestArtist;
  if (isExactSong) return bestSong;
  if (isExactAlbum) return bestAlbum;

  if (bestArtist) return bestArtist;
  if (bestSong) return bestSong;
  if (bestAlbum) return bestAlbum;

  return undefined;
}

export function determineSectionOrdering(intent: SearchIntent): SectionOrdering {
  let primary = intent.requestedEntity || intent.primary;
  
  if (intent.confidence < 0.6) {
    primary = 'GENERIC';
  }

  switch (primary) {
    case 'ARTIST':
      return { sections: ['TopResult', 'Artists', 'Songs', 'Albums'] };
    case 'ALBUM':
      return { sections: ['TopResult', 'Albums', 'Songs', 'Artists'] };
    case 'SONG':
      return { sections: ['TopResult', 'Songs', 'Artists', 'Albums'] };
    case 'DISCOVERY':
    case 'GENERIC':
    default:
      return { sections: ['TopResult', 'Songs', 'Artists', 'Albums'] };
  }
}
