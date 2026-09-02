export function normalizeQuery(q: string): string {
  if (!q) return '';
  return q
    .normalize('NFD') // Decompose Unicode (e.g. è -> e + `)
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/gi, ' ') // Keep alphanumeric and Hindi characters, replace punctuation with spaces
    .replace(/\b(official audio|official video|lyric video|lyrics|hd|4k|audio|video)\b/gi, '') // Remove common noise words
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

export interface SearchIntent {
  primary: 'artist' | 'album' | 'song' | 'generic';
  confidence: number;
}

export function detectSearchIntent(q: string): SearchIntent {
  const norm = normalizeQuery(q);
  
  if (q.toLowerCase().startsWith('artist:')) return { primary: 'artist', confidence: 1.0 };
  if (q.toLowerCase().startsWith('album:')) return { primary: 'album', confidence: 1.0 };
  if (q.toLowerCase().startsWith('song:')) return { primary: 'song', confidence: 1.0 };
  
  if (norm.match(/\b(album|soundtrack|ost)\b/)) {
    return { primary: 'album', confidence: 0.85 };
  }
  
  // Some common known artists could be detected here, but generically we rely on TopResult for exact matches
  return { primary: 'generic', confidence: 0.1 };
}

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

export function isMeaningfulVariant(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    lower.includes('remix') ||
    lower.includes('acoustic') ||
    lower.includes('live') ||
    lower.includes('unplugged') ||
    lower.includes('reprise') ||
    lower.includes('instrumental') ||
    lower.includes('slowed') ||
    lower.includes('reverb') ||
    lower.includes('extended') ||
    lower.includes('radio edit') ||
    lower.includes('version') ||
    lower.includes('mashup')
  );
}

// Canonical matching considers titles similar if they have high string similarity 
// AND they don't diverge on meaningful variants (e.g., one is a remix, the other isn't).
export function isCanonicalMatch(title1: string, title2: string, duration1: number, duration2: number): boolean {
  const norm1 = normalizeQuery(title1);
  const norm2 = normalizeQuery(title2);
  
  // Same normalized title + similar duration is a very strong signal
  const isExactTitleMatch = norm1 === norm2;
  const isDurationMatch = Math.abs(duration1 - duration2) <= 3;
  
  if (isExactTitleMatch && isDurationMatch) return true;
  
  // If one is a meaningful variant and the other is not, they are NOT a canonical match
  const variant1 = isMeaningfulVariant(title1);
  const variant2 = isMeaningfulVariant(title2);
  if (variant1 !== variant2) return false;
  
  const sim = stringSimilarity(title1, title2);
  
  // High similarity + duration match
  if (sim >= 0.85 && isDurationMatch) return true;
  
  // Very high similarity without duration match (e.g. YouTube video has intro)
  if (sim >= 0.95) return true;
  
  return false;
}
