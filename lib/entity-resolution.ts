import { CanonicalArtist, CanonicalAlbum, AudioSourcePlatform } from '@/types/explore';
import { normalizeArtist, normalizeTitle } from './music-ranking';
import { normalizeQuery } from './search-parser';

export function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix = Array(bLen + 1).fill(null).map(() => Array(aLen + 1).fill(null));

  for (let i = 0; i <= aLen; i += 1) {
    matrix[0][i] = i;
  }
  for (let j = 0; j <= bLen; j += 1) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= bLen; j += 1) {
    for (let i = 1; i <= aLen; i += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[bLen][aLen];
}

export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeQuery(a);
  const normB = normalizeQuery(b);
  if (normA === normB) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;
  
  const distance = levenshteinDistance(normA, normB);
  const maxLength = Math.max(normA.length, normB.length);
  return 1 - distance / maxLength;
}

export function isCanonicalArtistMatch(
  artist1: CanonicalArtist | { name: string; id?: string },
  artist2: CanonicalArtist | { name: string; id?: string }
): boolean {
  if (artist1.id && artist2.id && artist1.id === artist2.id) return true;

  const norm1 = normalizeQuery(artist1.name);
  const norm2 = normalizeQuery(artist2.name);

  if (norm1 === norm2) {
    // If names are exactly the same, check if they are very generic like "Various Artists"
    if (norm1 === 'various artists' || norm1 === 'unknown') return false;
    return true;
  }

  const sim = stringSimilarity(artist1.name, artist2.name);
  if (sim >= 0.95) return true;

  return false;
}

export function isCanonicalAlbumMatch(
  album1: CanonicalAlbum | { name: string; artist: string; year?: string },
  album2: CanonicalAlbum | { name: string; artist: string; year?: string }
): boolean {
  const normTitle1 = normalizeQuery(album1.name);
  const normTitle2 = normalizeQuery(album2.name);
  
  const titleSim = stringSimilarity(album1.name, album2.name);

  // Different editions checks
  const isDeluxe1 = normTitle1.includes('deluxe');
  const isDeluxe2 = normTitle2.includes('deluxe');
  if (isDeluxe1 !== isDeluxe2) return false;

  const isRemastered1 = normTitle1.includes('remastered');
  const isRemastered2 = normTitle2.includes('remastered');
  if (isRemastered1 !== isRemastered2) return false;

  const normArtist1 = normalizeArtist(album1.artist).primary;
  const normArtist2 = normalizeArtist(album2.artist).primary;
  
  // Exact title and exact artist
  if (normTitle1 === normTitle2 && normArtist1 === normArtist2) {
    return true;
  }

  // Highly similar title and exact artist
  if (titleSim >= 0.9 && normArtist1 === normArtist2) {
    return true;
  }

  return false;
}
