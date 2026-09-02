import { ExploreSearchResult } from '@/types/explore';
import { levenshteinDistance, stringSimilarity } from './entity-resolution';

export type SearchResultState = 
  | 'A_NORMAL' 
  | 'B_WEAK' 
  | 'C_ZERO';

export interface SearchRecoveryResult {
  state: SearchResultState;
  suggestedCorrection?: string;
  isRecovered: boolean;
}

export function evaluateSearchResultQuality(
  originalQuery: string,
  result: ExploreSearchResult
): SearchRecoveryResult {
  const totalResults = result.songs.length + result.artists.length + result.albums.length;
  
  if (totalResults === 0) {
    return {
      state: 'C_ZERO',
      suggestedCorrection: generateTypoCorrection(originalQuery),
      isRecovered: false
    };
  }

  if (totalResults < 3) {
    return {
      state: 'B_WEAK',
      isRecovered: false
    };
  }

  // Check top result intent matching
  if (result.topResult) {
    return {
      state: 'A_NORMAL',
      isRecovered: true
    };
  }

  return {
    state: 'A_NORMAL',
    isRecovered: true
  };
}

// In a real system, this would use a trie, a dictionary, or a fast n-gram index.
// For our typescript-native implementation, we will use a small curated dictionary of 
// common complex artist/song names that are frequently misspelled, and if the 
// Levenshtein distance is small enough, we return a correction.
const COMMONLY_MISSPELLED: Record<string, string> = {
  'arijit sing': 'Arijit Singh',
  'arijittt': 'Arijit Singh',
  'arijeet singh': 'Arijit Singh',
  'atif aslan': 'Atif Aslam',
  'shreya ghosal': 'Shreya Ghoshal',
  'jubin nautial': 'Jubin Nautiyal',
  'neha kakar': 'Neha Kakkar',
  'ar rehman': 'A.R. Rahman',
  'tho phir aao': 'Toh Phir Aao',
  'chana mereya': 'Channa Mereya',
  'ashiqui 2': 'Aashiqui 2',
};

export function generateTypoCorrection(query: string): string | undefined {
  const qLower = query.toLowerCase().trim();
  
  if (COMMONLY_MISSPELLED[qLower]) {
    return COMMONLY_MISSPELLED[qLower];
  }

  let bestMatch: string | undefined = undefined;
  let highestSim = 0;

  // We can also do a fuzzy search across known keys
  for (const [misspelled, correct] of Object.entries(COMMONLY_MISSPELLED)) {
    // If the user's query is highly similar to the known correct name
    const sim = stringSimilarity(query, correct);
    if (sim > 0.8 && sim < 1.0 && sim > highestSim) {
      highestSim = sim;
      bestMatch = correct;
    }
  }

  if (highestSim > 0.8) {
    return bestMatch;
  }

  return undefined;
}
