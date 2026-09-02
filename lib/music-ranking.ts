import { ExploreSong, AudioSourcePlatform, SourceBadge } from '@/types/explore';

export type CandidateTrack = any;

// Curated regional artist & cultural keywords dictionary
const REGIONAL_ARTIST_DICTIONARY: Record<string, string[]> = {
  punjabi: [
    'diljit', 'karan aujla', 'sidhu moose', 'sidhu', 'ap dhillon', 'shubh', 'amrinder gill',
    'b praak', 'jass manak', 'hardy sandhu', 'amrit maan', 'gurdas maan', 'parmish verma',
    'gippy grewal', 'sunanda sharma', 'guru randhawa', 'jasleen royal', 'harrdy', 'punjabi'
  ],
  hindi: [
    'arijit singh', 'arijit', 'neha kakkar', 'jubin nautiyal', 'jubin', 'shreya ghoshal',
    'badshah', 'sonu nigam', 'kishore kumar', 'lata mangeshkar', 'mohit chauhan', 'atif aslam',
    'vishal mishra', 'pritam', 'sachet tandon', 'armaan malik', 'alka yagnik', 'kumar sanu',
    'udit narayan', 'anuv jain', 'yo yo honey singh', 'king', 'bollywood', 'hindi'
  ],
  bhojpuri: [
    'pawan singh', 'khesari lal', 'shilpi raj', 'arvind akela', 'kallu', 'pramod premi',
    'ritesh pandey', 'dinesh lal', 'nirahua', 'neelkamal singh', 'ankush raja', 'gunjan singh',
    'akshara singh', 'antra singh', 'chhotu chhaliya', 'bhojpuri'
  ],
  tamil: [
    'anirudh', 'ar rahman', 'yuvan shankar', 'yuvan', 'harris jayaraj', 'sid sriram',
    'ilayaraja', 'vijay', 'dhanush', 'santhosh narayanan', 'gv prakash', 'd imman',
    'spb', 's p balasubrahmanyam', 'pradeep kumar', 'sean roldan', 'tamil'
  ],
  telugu: [
    'thaman', 'devi sri prasad', 'dsp', 'sid sriram', 'anurag kulkarni', 'ram miriyala',
    'mm keeravani', 'keeravani', 'mickey j meyer', 'chiranjeevi', 'balakrishna', 'allu arjun',
    'ram charan', 'jr ntr', 'sri krishna', 'telugu'
  ],
  bengali: [
    'arijit singh', 'anupam roy', 'shreya ghoshal', 'shaan', 'somlata', 'rupam islam',
    'monali thakur', 'nachiketa', 'hemanta', 'manna dey', 'rabindra sangeet', 'bengali', 'bangla'
  ],
  malayalam: [
    'sushin shyam', 'hesgam abdul wahab', 'shaan rahman', 'gopi sundar', 'ks harisankar',
    'vineeth sreenivasan', 'jassie gift', 'mg sreekumar', 'yesudas', 'malayalam'
  ],
  kannada: [
    'ravi basrur', 'arjun janya', 'charan raj', 'vijay prakash', 'sanjith hegde',
    'sonu nigam', 'raghu dixit', 'vasuki vaibhav', 'kannada'
  ],
  marathi: [
    'ajay atul', 'ajay gogavale', 'swapnil bandodkar', 'adarsh shinde', 'avdhoot gupte',
    'anand shinde', 'mahesh kale', 'marathi'
  ],
  gujarati: [
    'kinjal dave', 'geeta rabari', 'jignesh kaviraj', 'kirtidan gadhvi', 'aditya gadhvi',
    'garba', 'osman mir', 'gujarati'
  ],
  haryanvi: [
    'gulzaar chhaniwala', 'sapna choudhary', 'renuka panwar', 'diler kharkiya',
    'amit saini rohtakiya', 'masoom sharma', 'sumit goswami', 'haryanvi'
  ],
  odia: [
    'humane sagar', 'aseema panda', 'kuldeep pattanaik', 'ananya nanda',
    'mantu chhuria', 'satyajeet pradhan', 'tariq aziz', 'ira mohanty',
    'babushan mohanty', 'asad nizam', 'shashank shekhar', 'odia', 'oriya'
  ],
  english: [
    'billboard', 'taylor swift', 'drake', 'the weeknd', 'ed sheeran', 'dua lipa',
    'billie eilish', 'post malone', 'justin bieber', 'ariana grande', 'bruno mars',
    'olivia rodrigo', 'coldplay', 'eminem', 'maroon 5', 'rihanna', 'beyonce', 'english'
  ],
};

// Unicode regex patterns for regional Indian scripts
const REGIONAL_SCRIPT_PATTERNS: Record<string, RegExp> = {
  hindi: /[\u0900-\u097F]/,     // Devanagari
  bhojpuri: /[\u0900-\u097F]/,  // Devanagari
  marathi: /[\u0900-\u097F]/,   // Devanagari
  punjabi: /[\u0A00-\u0A7F]/,   // Gurmukhi
  tamil: /[\u0B80-\u0BFF]/,     // Tamil
  telugu: /[\u0C00-\u0C7F]/,    // Telugu
  bengali: /[\u0980-\u09FF]/,   // Bengali
  malayalam: /[\u0D00-\u0D7F]/, // Malayalam
  kannada: /[\u0C80-\u0CFF]/,   // Kannada
  gujarati: /[\u0A80-\u0AFF]/,  // Gujarati
  odia: /[\u0B00-\u0B7F]/,      // Odia
};

// Common clutter suffixes in video/track titles
const TITLE_CLEAN_REGEX = /\b(official\s*(music)?\s*(video|audio|track)?|lyric\s*(video)?|full\s*(video|audio|song|track)?|audio|video|hd|4k|remastered|trending\s*version|hq|original\s*mix)\b/gi;
const PARENTHESES_REGEX = /\s*[\(\[\{][^\)\]\}]*[\)\]\}]\s*/g;

/**
 * Normalizes song title for fuzzy canonical matching
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(TITLE_CLEAN_REGEX, ' ')
    .replace(PARENTHESES_REGEX, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes artist string and extracts primary artist
 */
export function normalizeArtist(artistStr: string): { primary: string; all: string[]; normalized: string } {
  if (!artistStr) return { primary: 'unknown', all: [], normalized: 'unknown' };

  const clean = artistStr
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  // Split multi-artist tokens
  const parts = clean
    .split(/[,&/|]|\b(?:ft\.?|feat\.?|featuring|with|and|x|vs)\b/i)
    .map((p) => p.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' '))
    .filter((p) => p.length > 1);

  const primary = parts[0] || 'unknown';
  const all = parts.length > 0 ? parts : [primary];
  const normalized = all.join(' ');

  return { primary, all, normalized };
}

/**
 * Converts a raw ExploreSong into an enriched CandidateTrack
 */
export function toCandidateTrack(song: ExploreSong, providerRank: number): CandidateTrack {
  const normTitle = normalizeTitle(song.name);
  const { primary, all, normalized: normArtist } = normalizeArtist(song.artist);

  const lowerName = song.name.toLowerCase();

  const isRemix = lowerName.includes('remix') || lowerName.includes('mashup') || lowerName.includes('club mix');
  const isPlaylistOrMix = lowerName.includes('playlist') || lowerName.includes('jukebox') || lowerName.includes('non stop') || lowerName.includes('nonstop') || (song.duration > 720);
  const isKaraokeOrCover = lowerName.includes('karaoke') || lowerName.includes('cover') || lowerName.includes('instrumental') || lowerName.includes('tribute');

  return {
    id: song.id,
    title: song.name,
    normalizedTitle: normTitle,
    artists: all,
    primaryArtist: primary,
    normalizedArtist: normArtist,
    album: song.album,
    year: song.year,
    duration: song.duration,
    cover: song.cover,
    streamUrl: song.streamUrl,
    quality: song.quality,
    source: song.source || 'jiosaavn',
    sourceBadge: song.sourceBadge || {
      name: 'JioSaavn',
      icon: '🟢',
      color: '#1ed760',
      bg: 'rgba(30, 215, 96, 0.12)',
      border: 'rgba(30, 215, 96, 0.3)',
      qualityLabel: '320k Master',
    },
    hasLyrics: !!song.hasLyrics,
    language: song.language,
    providerRank,
    isRemix,
    isPlaylistOrMix,
    isKaraokeOrCover,
  };
}

/**
 * Validates language match confidence using provider tags, regional artist names, and script tokens
 */
export function computeLanguageMatchScore(track: CandidateTrack, targetLanguage: string): number {
  if (!targetLanguage || targetLanguage.toLowerCase() === 'all') return 1.0;

  const target = targetLanguage.toLowerCase().trim();
  const trackLang = (track.language || '').toLowerCase().trim();

  // 1. Direct provider metadata match
  if (trackLang === target) return 1.0;

  const textToInspect = `${track.title} ${track.primaryArtist} ${track.artists.join(' ')} ${track.album || ''}`.toLowerCase();

  // 2. Regional artist dictionary check
  const regionalKeywords = REGIONAL_ARTIST_DICTIONARY[target];
  if (regionalKeywords) {
    for (const kw of regionalKeywords) {
      if (textToInspect.includes(kw)) return 1.0;
    }
  }

  // 3. Regional Unicode script match
  const scriptRegex = REGIONAL_SCRIPT_PATTERNS[target];
  if (scriptRegex && (scriptRegex.test(track.title) || scriptRegex.test(track.primaryArtist))) {
    return 1.0;
  }

  // 4. If track explicitly states a conflicting Indian regional language, penalize heavily
  const knownLanguages = Object.keys(REGIONAL_ARTIST_DICTIONARY);
  for (const otherLang of knownLanguages) {
    if (otherLang !== target && trackLang === otherLang) {
      return 0.05; // Confident mismatch (e.g. Tamil song when Bhojpuri requested)
    }
  }

  // 5. Default neutral score for unclassified international / pop tracks
  return 0.5;
}

/**
 * Computes a unified 0.0 to 1.0 ranking score based on multi-factor signals
 */
export function computeUnifiedScore(track: CandidateTrack, targetLanguage: string): number {
  // Provider Rank Score
  const rankScore = Math.max(0.1, 1.0 - (track.providerRank - 1) * 0.035);

  // Language Validation (0.05 to 1.0)
  const langScore = computeLanguageMatchScore(track, targetLanguage);

  // Dynamic Quality Score based on metadata instead of hardcoded provider rank
  let qualityScore = 0.5;
  if (track.quality === '320kbps') qualityScore = 1.0;
  else if (track.quality === '160kbps') qualityScore = 0.85;
  else if (track.quality === '128kbps') qualityScore = 0.70;
  
  if (track.source === 'jiosaavn') qualityScore += 0.05; // Official metadata bonus

  // Freshness bonus (boost recent releases)
  let freshnessScore = 0.6;
  if (track.year) {
    const yr = parseInt(track.year, 10);
    const currentYear = new Date().getFullYear();
    if (yr >= currentYear - 1) freshnessScore = 1.0;
    else if (yr >= currentYear - 3) freshnessScore = 0.85;
    else if (yr >= currentYear - 8) freshnessScore = 0.70;
  }

  // Base weighted composite score
  let finalScore =
    0.30 * rankScore +
    0.25 * langScore +
    0.30 * qualityScore +
    0.15 * freshnessScore;

  // Penalties for non-standard tracks in trending discovery
  if (track.isRemix) finalScore -= 0.12;
  if (track.isKaraokeOrCover) finalScore -= 0.35;
  if (track.isPlaylistOrMix) finalScore -= 0.45;

  return Math.max(0.01, Math.min(1.0, Math.round(finalScore * 1000) / 1000));
}

/**
 * Filter out junk, podcasts, ringtones, and playlist compilations
 */
export function isCleanTrack(track: CandidateTrack): boolean {
  // Length filters: min 45 seconds, max 12 minutes (720 seconds)
  if (track.duration < 45 || track.duration > 720) return false;

  // Junk title filter
  if (track.isPlaylistOrMix || track.isKaraokeOrCover) return false;

  // Title must have substance
  if (!track.normalizedTitle || track.normalizedTitle.length < 2) return false;

  return true;
}

/**
 * Canonical Track Clustering & Deduplication:
 * Clusters duplicate versions of the same song across providers using a confidence hierarchy.
 */
export function deduplicateCandidates(candidates: CandidateTrack[]): CandidateTrack[] {
  const clusters = new Map<string, CandidateTrack[]>();

  for (const track of candidates) {
    if (!isCleanTrack(track)) continue;

    const clusterKey = `${track.normalizedTitle}___${track.primaryArtist}`;
    let matchedClusterKey: string | null = null;
    let highestConfidence = 0;

    clusters.forEach((existingCluster, existingKey) => {
      if (highestConfidence >= 4) return; // Found perfect match
      const rep = existingCluster[0];
      
      // Prevent merging of meaningful variants (e.g. remix vs original)
      if (rep.isRemix !== track.isRemix || rep.isKaraokeOrCover !== track.isKaraokeOrCover) return;

      // Confidence Hierarchy
      let confidence = 0;
      
      // 1. ISRC Match (Highest Confidence)
      if (rep.isrc && track.isrc && rep.isrc === track.isrc) {
        confidence = 4;
      } 
      // 2. Title + Primary Artist + Duration similarity
      else if (rep.normalizedTitle === track.normalizedTitle && rep.primaryArtist === track.primaryArtist && Math.abs(rep.duration - track.duration) <= 3) {
        confidence = 3;
      }
      // 3. Canonical Title + Artist Match
      else if (rep.normalizedTitle === track.normalizedTitle && (rep.primaryArtist === track.primaryArtist || rep.artists.some((a: string) => track.artists.includes(a)))) {
        confidence = 2;
      }
      // 4. Fuzzy similarity (Fallback/Supporting signal)
      else {
        const titleMatch = (rep.normalizedTitle.length > 5 && track.normalizedTitle.includes(rep.normalizedTitle)) || (track.normalizedTitle.length > 5 && rep.normalizedTitle.includes(track.normalizedTitle));
        const artistMatch = rep.primaryArtist === track.primaryArtist;
        const durationMatch = Math.abs(rep.duration - track.duration) <= 5;
        
        if (titleMatch && artistMatch && durationMatch) {
          confidence = 1;
        }
      }

      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        matchedClusterKey = existingKey;
      }
    });

    const targetKey = matchedClusterKey && highestConfidence >= 2 ? matchedClusterKey : clusterKey;
    if (!clusters.has(targetKey)) {
      clusters.set(targetKey, []);
    }
    clusters.get(targetKey)!.push(track);
  }

  const deduplicated: CandidateTrack[] = [];

  clusters.forEach((cluster) => {
    // Sort cluster candidates by audio quality preference to select the best primary display entity
    cluster.sort((a, b) => {
      // Prefer highest bitrate
      const bitrateA = parseInt(a.quality);
      const bitrateB = parseInt(b.quality);
      if (bitrateA !== bitrateB) return bitrateB - bitrateA;
      // Break tie with provider rank
      return a.providerRank - b.providerRank;
    });

    const primary = { ...cluster[0] };
    const availableSources = Array.from(new Set(cluster.map(c => c.source)));
    
    // Attach multiple sources for fallback streams
    const sources: any = {};
    for (const c of cluster) {
      if (c.source && !sources[c.source]) {
        sources[c.source] = {
          streamUrl: c.streamUrl,
          quality: c.quality,
          id: c.id,
          badge: c.sourceBadge,
        };
      }
    }

    (primary as any).canonicalKey = `${primary.normalizedTitle}___${primary.primaryArtist}`;
    (primary as any).availableSources = availableSources;
    (primary as any).sources = sources;

    deduplicated.push(primary);
  });

  return deduplicated;
}

/**
 * Score-Driven Diversity Re-Ranking:
 * Strictly prioritizes highest-scoring tracks while enforcing a soft diversity constraint:
 * maximum 2 consecutive tracks from the same audio provider.
 */
export function rankAndDiversifyCandidates(
  rawSongs: ExploreSong[],
  targetLanguage: string,
  limit: number = 30
): ExploreSong[] {
  // 1. Normalize into candidate tracks with provider-isolated ranking
  const sourceRankCount: Record<string, number> = {};
  const candidates: CandidateTrack[] = rawSongs.map((s) => {
    const src = s.source || 'jiosaavn';
    sourceRankCount[src] = (sourceRankCount[src] || 0) + 1;
    const providerRank = (s as any).providerRank || sourceRankCount[src];
    return toCandidateTrack(s, providerRank);
  });

  // 2. Canonical Deduplication & Quality Filtering
  const uniqueCandidates = deduplicateCandidates(candidates);

  // 3. Compute Unified Score for all deduplicated tracks
  const scoredTracks = uniqueCandidates.map((track) => ({
    track,
    score: computeUnifiedScore(track, targetLanguage),
  }));

  // 4. Sort strictly by unified score descending
  scoredTracks.sort((a, b) => b.score - a.score);

  // 5. Apply Diversity Constraint (Max 2 consecutive tracks from same provider)
  const diversified: { track: CandidateTrack; score: number }[] = [];
  const remaining = [...scoredTracks];

  let lastProvider: AudioSourcePlatform | null = null;
  let consecutiveCount = 0;

  while (remaining.length > 0 && diversified.length < limit) {
    let nextIdx = 0;

    // If 2 or more consecutive tracks are from the same provider, diversify
    if (consecutiveCount >= 2 && lastProvider !== null) {
      const topScore = remaining[0].score;
      // Look for highest-scoring track from an alternative provider within score delta <= 0.25
      let altIdx = remaining.findIndex(
        (item) => item.track.source !== lastProvider && (topScore - item.score) <= 0.25
      );

      // If consecutive count reaches 3, force diversification to prevent provider monopolization
      if (altIdx === -1 && consecutiveCount >= 3) {
        altIdx = remaining.findIndex((item) => item.track.source !== lastProvider);
      }

      if (altIdx !== -1) {
        nextIdx = altIdx;
      }
    }

    const selected = remaining.splice(nextIdx, 1)[0];
    diversified.push(selected);

    if (selected.track.source === lastProvider) {
      consecutiveCount++;
    } else {
      lastProvider = selected.track.source || null;
      consecutiveCount = 1;
    }
  }

  // 6. Convert back to ExploreSong contract with attached ranking metadata
  return diversified.map(({ track, score }) => ({
    id: track.id,
    name: track.title,
    artist: track.artists.length > 0 ? track.artists.join(', ') : track.primaryArtist,
    album: track.album || 'Deluxe Music',
    year: track.year,
    duration: track.duration,
    cover: track.cover,
    streamUrl: track.streamUrl,
    quality: track.quality,
    source: track.source,
    sourceBadge: track.sourceBadge,
    language: track.language,
    hasLyrics: track.hasLyrics,
    canonicalKey: (track as any).canonicalKey,
    unifiedScore: score,
    availableSources: (track as any).availableSources,
    sources: (track as any).sources,
    rankingMode: 'discovery' as const,
  }));
}

/**
 * CHART MODE: Source-Authoritative Ranking with Deterministic Downstream Processing
 * 
 * Preserves the exact 1-indexed order of the authoritative chart provider (#1, #2, #3...).
 * Performs canonical deduplication to ensure unique entries and fuses secondary sources
 * (e.g. attaches YouTube video or JioSaavn 320k audio) without altering chart position.
 */
export function preserveAuthoritativeChartRanking(
  primaryChartTracks: ExploreSong[],
  secondaryTracks: ExploreSong[] = [],
  limit = 50
): ExploreSong[] {
  const seenCanonicalKeys = new Set<string>();
  const chartResults: ExploreSong[] = [];

  // Index secondary tracks by normalized key for rapid O(1) source fusion
  const secondaryMap = new Map<string, ExploreSong>();
  for (const track of secondaryTracks) {
    const normTitle = normalizeTitle(track.name);
    const normArtist = normalizeArtist(track.artist).primary;
    if (normTitle) {
      secondaryMap.set(`${normTitle}___${normArtist}`, track);
    }
  }

  for (const track of primaryChartTracks) {
    if (chartResults.length >= limit) break;

    const normTitle = normalizeTitle(track.name);
    const normArtist = normalizeArtist(track.artist).primary;
    const canonicalKey = `${normTitle}___${normArtist}`;

    // Deduplicate within the primary chart to guarantee unique songs
    if (seenCanonicalKeys.has(canonicalKey)) {
      continue;
    }
    seenCanonicalKeys.add(canonicalKey);

    const availableSources: AudioSourcePlatform[] = [track.source || 'jiosaavn'];

    // Check if secondary tracks contain a counterpart for source fusion
    const secondaryMatch = secondaryMap.get(canonicalKey);
    if (secondaryMatch && secondaryMatch.source && !availableSources.includes(secondaryMatch.source)) {
      availableSources.push(secondaryMatch.source);
    }

    const rank = chartResults.length + 1;

    chartResults.push({
      ...track,
      canonicalKey,
      chartRank: rank,
      rankingMode: 'chart',
      availableSources,
      sources: {
        ...(track as any).sources, // Preserve existing sources if any
        [track.source || 'jiosaavn']: {
          streamUrl: track.streamUrl,
          quality: track.quality,
          id: track.id,
          badge: track.sourceBadge,
        },
        ...(secondaryMatch?.source ? {
          [secondaryMatch.source]: {
            streamUrl: secondaryMatch.streamUrl,
            quality: secondaryMatch.quality,
            id: secondaryMatch.id,
            badge: secondaryMatch.sourceBadge,
          }
        } : {})
      }
    } as any);
  }

  return chartResults;
}
