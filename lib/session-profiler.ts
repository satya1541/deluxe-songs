/**
 * Session Profiler — Converts raw listening events into deterministic preference signals.
 *
 * This module is the sole authority on interpreting user behavior within a session.
 * It does NOT rank candidates — it produces a SessionProfile that the scorer consumes.
 */

import { ListeningEvent, ListeningAction, SessionContext } from '@/types/recommendation';
import { normalizeArtist, normalizeTitle } from './music-ranking';
import { EmotionType, getInstantEmotion } from './emotions';

// ─── Configurable Event Weights (§6) ────────────────────────────
// Centralized so they can later be tuned from real behavioral data.
export const EVENT_WEIGHTS: Record<ListeningAction, number> = {
  play:     0.10,
  skip:    -0.70,
  complete: 0.80,
  replay:   1.00,
  like:     1.25,
};

// ─── Skip Intelligence Tiers (§7) ───────────────────────────────
// A skip after 3 seconds is very different from a skip at 95% completion.
function getSkipMultiplier(progress: number | undefined): number {
  if (progress === undefined || progress === null) return 0.7; // unknown progress → moderate
  if (progress < 0.10) return 1.0;   // 0–10%: strong negative signal
  if (progress < 0.50) return 0.7;   // 10–50%: moderate negative signal
  if (progress < 0.90) return 0.3;   // 50–90%: weak negative signal
  return 0.0;                         // 90–100%: effectively a completion
}

// ─── Recency Decay (§5) ─────────────────────────────────────────
const DECAY_CONSTANT_MS = 3600 * 1000 * 6; // 6-hour half-life for session relevance

function decayedWeight(timestampMs: number, nowMs: number): number {
  const ageMs = Math.max(0, nowMs - timestampMs);
  return Math.exp(-ageMs / DECAY_CONSTANT_MS);
}

// ─── Mood Similarity Matrix (§15) ───────────────────────────────
// Hand-defined soft similarity. Never hard-reject based on mood.
const MOOD_GROUPS: Record<string, string[]> = {
  melancholy:  ['sad_romantic', 'heartbroken_romantic', 'heartbroken', 'lonely_romantic'],
  longing:     ['yearning_romantic', 'nostalgic_romantic', 'bittersweet_romantic'],
  tender:      ['soft_romantic', 'intimate_romantic', 'content_romantic'],
  passionate:  ['dark_romantic', 'sensual_romantic'],
  joyful:      ['happy_romantic', 'adoring_romantic', 'hopeful_romantic'],
  spiritual:   ['devotional_romantic', 'dreamy_romantic'],
};

// Build reverse lookup: emotion → group
const MOOD_TO_GROUP: Record<string, string> = {};
for (const [group, emotions] of Object.entries(MOOD_GROUPS)) {
  for (const e of emotions) {
    MOOD_TO_GROUP[e] = group;
  }
}

// Similarity between groups (symmetric)
const GROUP_SIMILARITY: Record<string, Record<string, number>> = {
  melancholy:  { melancholy: 1.0, longing: 0.8, tender: 0.5, passionate: 0.3, joyful: 0.1, spiritual: 0.4 },
  longing:     { melancholy: 0.8, longing: 1.0, tender: 0.6, passionate: 0.4, joyful: 0.2, spiritual: 0.5 },
  tender:      { melancholy: 0.5, longing: 0.6, tender: 1.0, passionate: 0.4, joyful: 0.7, spiritual: 0.6 },
  passionate:  { melancholy: 0.3, longing: 0.4, tender: 0.4, passionate: 1.0, joyful: 0.5, spiritual: 0.3 },
  joyful:      { melancholy: 0.1, longing: 0.2, tender: 0.7, passionate: 0.5, joyful: 1.0, spiritual: 0.4 },
  spiritual:   { melancholy: 0.4, longing: 0.5, tender: 0.6, passionate: 0.3, joyful: 0.4, spiritual: 1.0 },
};

export function getMoodSimilarity(moodA: string | null | undefined, moodB: string | null | undefined): number {
  if (!moodA || !moodB) return 0.5; // neutral if unknown
  if (moodA === moodB) return 1.0;

  const groupA = MOOD_TO_GROUP[moodA] || 'tender';
  const groupB = MOOD_TO_GROUP[moodB] || 'tender';
  if (groupA === groupB) return 0.9; // same group but different specific emotion

  return GROUP_SIMILARITY[groupA]?.[groupB] ?? 0.3;
}

// ─── Session Profile Output ─────────────────────────────────────
export interface SessionProfile {
  /** Artist → affinity score (positive = preferred, negative = avoided) */
  artistAffinities: Map<string, number>;

  /** Language → affinity score (higher = stronger preference) */
  languageAffinities: Map<string, number>;

  /** Dominant session language (highest affinity) */
  dominantLanguage: string | null;

  /** Dominant session mood */
  dominantMood: string | null;

  /** Track IDs that were recently played (for novelty calculation) */
  recentTrackIds: Set<string>;

  /** Canonical keys that were recently played */
  recentCanonicalKeys: Set<string>;

  /** Map of trackId/canonicalKey → position-in-history (0 = most recent) for novelty */
  trackRecency: Map<string, number>;

  /** Tracks that were explicitly skipped (for negative signals) */
  skippedTrackIds: Set<string>;

  /** Artists that were recently skipped (compound penalty) */
  skippedArtistPenalties: Map<string, number>;

  /** Artists that appeared recently (for overexposure detection) */
  recentArtistCounts: Map<string, number>;

  /** Albums that appeared recently (for repetition detection) */
  recentAlbums: Set<string>;
}

// ─── Profile Builder (§5) ───────────────────────────────────────
export function buildSessionProfile(context: SessionContext): SessionProfile {
  const now = Date.now();
  const history = context.recentHistory || [];

  const artistAffinities = new Map<string, number>();
  const languageAffinities = new Map<string, number>();
  const recentTrackIds = new Set<string>();
  const recentCanonicalKeys = new Set<string>();
  const trackRecency = new Map<string, number>();
  const skippedTrackIds = new Set<string>();
  const skippedArtistPenalties = new Map<string, number>();
  const recentArtistCounts = new Map<string, number>();
  const recentAlbums = new Set<string>();
  const moodCounts = new Map<string, number>();

  // Process events from oldest to newest (the index from the end gives recency)
  for (let i = 0; i < history.length; i++) {
    const event = history[i];
    const decay = decayedWeight(event.timestamp, now);
    const positionFromEnd = history.length - 1 - i; // 0 = most recent

    const trackKey = event.canonicalKey || event.trackId;
    recentTrackIds.add(event.trackId);
    if (event.canonicalKey) recentCanonicalKeys.add(event.canonicalKey);

    // Track recency: store the most recent position
    if (!trackRecency.has(trackKey) || (trackRecency.get(trackKey)! > positionFromEnd)) {
      trackRecency.set(trackKey, positionFromEnd);
    }

    const artist = event.artist ? normalizeArtist(event.artist).primary : '';
    const language = event.language || '';

    // Count recent artists for overexposure
    if (artist) {
      recentArtistCounts.set(artist, (recentArtistCounts.get(artist) || 0) + 1);
    }

    // Event-specific processing
    const baseWeight = EVENT_WEIGHTS[event.action] || 0;

    if (event.action === 'skip') {
      const skipMult = getSkipMultiplier(event.progress);
      const penalty = Math.abs(baseWeight) * skipMult * decay;

      skippedTrackIds.add(trackKey);

      if (artist) {
        const existing = skippedArtistPenalties.get(artist) || 0;
        skippedArtistPenalties.set(artist, existing + penalty);

        // Skips also reduce artist affinity
        const currentAffinity = artistAffinities.get(artist) || 0;
        artistAffinities.set(artist, currentAffinity - penalty);
      }
    } else {
      // Positive events: play, complete, replay, like
      const signal = baseWeight * decay;

      if (artist) {
        const currentAffinity = artistAffinities.get(artist) || 0;
        artistAffinities.set(artist, currentAffinity + signal);
      }

      // Language affinity — only from positive events
      if (language && signal > 0) {
        const currentLang = languageAffinities.get(language) || 0;
        languageAffinities.set(language, currentLang + signal);
      }

      // Mood tracking — infer from artist/title if available
      if (event.artist) {
        const emotion = getInstantEmotion(trackKey, event.artist);
        if (emotion.emotion) {
          const moodStr = String(emotion.emotion);
          moodCounts.set(moodStr, (moodCounts.get(moodStr) || 0) + signal);
        }
      }
    }
  }

  // Determine dominant language
  let dominantLanguage: string | null = null;
  let maxLangScore = 0;
  for (const [lang, score] of Array.from(languageAffinities.entries())) {
    if (score > maxLangScore) {
      maxLangScore = score;
      dominantLanguage = lang;
    }
  }
  // Override with explicit context if provided
  if (context.activeLanguage && context.activeLanguage !== 'all') {
    dominantLanguage = context.activeLanguage;
  }

  // Determine dominant mood
  let dominantMood: string | null = context.currentMood || null;
  if (!dominantMood) {
    let maxMoodScore = 0;
    for (const [mood, score] of Array.from(moodCounts.entries())) {
      if (score > maxMoodScore) {
        maxMoodScore = score;
        dominantMood = mood;
      }
    }
  }

  return {
    artistAffinities,
    languageAffinities,
    dominantLanguage,
    dominantMood,
    recentTrackIds,
    recentCanonicalKeys,
    trackRecency,
    skippedTrackIds,
    skippedArtistPenalties,
    recentArtistCounts,
    recentAlbums,
  };
}

// ─── Novelty Score (§14) ────────────────────────────────────────
// How novel is a candidate relative to recent history?
export function getNoveltyScore(
  trackId: string,
  canonicalKey: string | undefined,
  profile: SessionProfile
): number {
  const key = canonicalKey || trackId;
  const recency = profile.trackRecency.get(key);

  if (recency === undefined) return 1.0;   // never played recently = maximum novelty
  if (recency <= 1)  return 0.05;           // played 0–1 tracks ago = nearly zero novelty
  if (recency <= 3)  return 0.15;
  if (recency <= 5)  return 0.30;
  if (recency <= 10) return 0.50;
  if (recency <= 20) return 0.70;
  return 0.85;
}

// ─── Language Affinity Score (§16) ──────────────────────────────
export function getLanguageAffinityScore(
  candidateLanguage: string | undefined,
  targetLanguage: string,
  profile: SessionProfile
): number {
  if (!candidateLanguage) return 0.5; // unknown language → neutral

  const candLang = candidateLanguage.toLowerCase();
  const target = targetLanguage.toLowerCase();

  // Exact match with active filter
  if (target !== 'all' && candLang === target) return 1.0;

  // Match with session-derived dominant language
  if (profile.dominantLanguage && candLang === profile.dominantLanguage.toLowerCase()) return 0.9;

  // Match with any positively-weighted language in session
  const sessionScore = profile.languageAffinities.get(candLang);
  if (sessionScore && sessionScore > 0) return 0.7;

  // Explicit mismatch with active filter
  if (target !== 'all' && candLang !== target) return 0.1;

  // Global mode, unknown affinity
  return 0.4;
}
