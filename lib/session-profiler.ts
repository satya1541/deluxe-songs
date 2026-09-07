/**
 * Session Profiler — Converts raw listening events into deterministic preference signals.
 *
 * This module is the sole authority on interpreting user behavior within a session.
 * It detects the 4-state Session Intent, computes dynamic feature weights,
 * and sets adaptive exploration ratios based on skip velocity and listening patterns.
 */

import {
  ListeningEvent,
  ListeningAction,
  SessionContext,
  SessionIntent,
  DynamicWeights,
  ExplorationMixRatio,
} from '@/types/recommendation';
import { normalizeArtist, normalizeTitle } from './music-ranking';
import { EmotionType, getInstantEmotion } from './emotions';

// ─── Configurable Event Weights ─────────────────────────────────
export const EVENT_WEIGHTS: Record<ListeningAction, number> = {
  play:     0.10,
  skip:    -0.70,
  complete: 0.80,
  replay:   1.00,
  like:     1.25,
};

// ─── 4 Dynamic Weight Profiles based on Session Intent ───────────
export const INTENT_WEIGHT_PROFILES: Record<SessionIntent, DynamicWeights> = {
  DEEP_FOCUS_ARTIST: {
    artistAffinity:   0.35,
    sessionAffinity:  0.25,
    userAffinity:     0.15,
    moodSimilarity:   0.10,
    languageAffinity: 0.05,
    popularity:       0.04,
    freshness:        0.03,
    novelty:          0.03,
  },
  MOOD_FLOW: {
    moodSimilarity:   0.30,
    sessionAffinity:  0.25,
    languageAffinity: 0.15,
    userAffinity:     0.12,
    artistAffinity:   0.08,
    popularity:       0.05,
    novelty:          0.03,
    freshness:        0.02,
  },
  CHARTS_POPULAR: {
    popularity:       0.25,
    userAffinity:     0.20,
    sessionAffinity:  0.20,
    languageAffinity: 0.15,
    artistAffinity:   0.10,
    moodSimilarity:   0.05,
    freshness:        0.03,
    novelty:          0.02,
  },
  ACTIVE_DISCOVERY: {
    novelty:          0.30,
    sessionAffinity:  0.20,
    popularity:       0.15,
    moodSimilarity:   0.15,
    userAffinity:     0.10,
    freshness:        0.05,
    languageAffinity: 0.05,
    artistAffinity:   0.00, // Suppressed: break out of the artist lock!
  },
};

// ─── Dynamic Exploration Ratios per Session Intent ──────────────
export const INTENT_EXPLORATION_RATIOS: Record<SessionIntent, ExplorationMixRatio> = {
  DEEP_FOCUS_ARTIST: { exploitation: 0.85, exploration: 0.10, discovery: 0.05 },
  MOOD_FLOW:         { exploitation: 0.75, exploration: 0.18, discovery: 0.07 },
  CHARTS_POPULAR:    { exploitation: 0.70, exploration: 0.20, discovery: 0.10 },
  ACTIVE_DISCOVERY:  { exploitation: 0.45, exploration: 0.35, discovery: 0.20 },
};

// ─── Skip Intelligence Tiers ────────────────────────────────────
function getSkipMultiplier(progress: number | undefined): number {
  if (progress === undefined || progress === null) return 0.7;
  if (progress < 0.10) return 1.0;   // 0–10%: immediate skip (strong negative)
  if (progress < 0.50) return 0.7;   // 10–50%: moderate skip
  if (progress < 0.90) return 0.3;   // 50–90%: soft skip
  return 0.0;                         // 90–100%: effectively finished
}

// ─── Recency Decay (6-hour half-life) ───────────────────────────
const DECAY_CONSTANT_MS = 3600 * 1000 * 6;

function decayedWeight(timestampMs: number, nowMs: number): number {
  const ageMs = Math.max(0, nowMs - timestampMs);
  return Math.exp(-ageMs / DECAY_CONSTANT_MS);
}

// ─── Mood Similarity Matrix ─────────────────────────────────────
const MOOD_GROUPS: Record<string, string[]> = {
  melancholy:  ['sad_romantic', 'heartbroken_romantic', 'heartbroken', 'lonely_romantic'],
  longing:     ['yearning_romantic', 'nostalgic_romantic', 'bittersweet_romantic'],
  tender:      ['soft_romantic', 'intimate_romantic', 'content_romantic'],
  passionate:  ['dark_romantic', 'sensual_romantic'],
  joyful:      ['happy_romantic', 'adoring_romantic', 'hopeful_romantic'],
  spiritual:   ['devotional_romantic', 'dreamy_romantic'],
};

const MOOD_TO_GROUP: Record<string, string> = {};
for (const [group, emotions] of Object.entries(MOOD_GROUPS)) {
  for (const e of emotions) {
    MOOD_TO_GROUP[e] = group;
  }
}

const GROUP_SIMILARITY: Record<string, Record<string, number>> = {
  melancholy:  { melancholy: 1.0, longing: 0.8, tender: 0.5, passionate: 0.3, joyful: 0.1, spiritual: 0.4 },
  longing:     { melancholy: 0.8, longing: 1.0, tender: 0.6, passionate: 0.4, joyful: 0.2, spiritual: 0.5 },
  tender:      { melancholy: 0.5, longing: 0.6, tender: 1.0, passionate: 0.4, joyful: 0.7, spiritual: 0.6 },
  passionate:  { melancholy: 0.3, longing: 0.4, tender: 0.4, passionate: 1.0, joyful: 0.5, spiritual: 0.3 },
  joyful:      { melancholy: 0.1, longing: 0.2, tender: 0.7, passionate: 0.5, joyful: 1.0, spiritual: 0.4 },
  spiritual:   { melancholy: 0.4, longing: 0.5, tender: 0.6, passionate: 0.3, joyful: 0.4, spiritual: 1.0 },
};

export function getMoodSimilarity(moodA: string | null | undefined, moodB: string | null | undefined): number {
  if (!moodA || !moodB) return 0.5;
  if (moodA === moodB) return 1.0;

  const groupA = MOOD_TO_GROUP[moodA] || 'tender';
  const groupB = MOOD_TO_GROUP[moodB] || 'tender';
  if (groupA === groupB) return 0.9;

  return GROUP_SIMILARITY[groupA]?.[groupB] ?? 0.3;
}

// ─── Session Profile Output ─────────────────────────────────────
export interface SessionProfile {
  detectedIntent: SessionIntent;
  dynamicWeights: DynamicWeights;
  explorationRatios: ExplorationMixRatio;
  skipVelocity: number;

  artistAffinities: Map<string, number>;
  languageAffinities: Map<string, number>;
  dominantLanguage: string | null;
  dominantMood: string | null;

  recentTrackIds: Set<string>;
  recentCanonicalKeys: Set<string>;
  trackRecency: Map<string, number>;
  skippedTrackIds: Set<string>;
  skippedArtistPenalties: Map<string, number>;
  recentArtistCounts: Map<string, number>;
  recentAlbums: Set<string>;
}

// ─── Profile Builder with Intent Detection ──────────────────────
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

  // Process events from oldest to newest
  for (let i = 0; i < history.length; i++) {
    const event = history[i];
    const decay = decayedWeight(event.timestamp, now);
    const positionFromEnd = history.length - 1 - i;

    const trackKey = event.canonicalKey || event.trackId;
    recentTrackIds.add(event.trackId);
    if (event.canonicalKey) recentCanonicalKeys.add(event.canonicalKey);

    if (!trackRecency.has(trackKey) || (trackRecency.get(trackKey)! > positionFromEnd)) {
      trackRecency.set(trackKey, positionFromEnd);
    }

    const artist = event.artist ? normalizeArtist(event.artist).primary : '';
    const language = event.language || '';

    if (artist) {
      recentArtistCounts.set(artist, (recentArtistCounts.get(artist) || 0) + 1);
    }

    const baseWeight = EVENT_WEIGHTS[event.action] || 0;

    if (event.action === 'skip') {
      const skipMult = getSkipMultiplier(event.progress);
      const penalty = Math.abs(baseWeight) * skipMult * decay;

      skippedTrackIds.add(trackKey);

      if (artist) {
        const existing = skippedArtistPenalties.get(artist) || 0;
        skippedArtistPenalties.set(artist, existing + penalty);

        const currentAffinity = artistAffinities.get(artist) || 0;
        artistAffinities.set(artist, currentAffinity - penalty);
      }
    } else {
      const signal = baseWeight * decay;

      if (artist) {
        const currentAffinity = artistAffinities.get(artist) || 0;
        artistAffinities.set(artist, currentAffinity + signal);
      }

      if (language && signal > 0) {
        const currentLang = languageAffinities.get(language) || 0;
        languageAffinities.set(language, currentLang + signal);
      }

      if (event.artist) {
        const emotion = getInstantEmotion(trackKey, event.artist);
        if (emotion.emotion) {
          const moodStr = String(emotion.emotion);
          moodCounts.set(moodStr, (moodCounts.get(moodStr) || 0) + signal);
        }
      }
    }
  }

  // ─── Intent Detection & Skip Velocity ──────────────────────────
  // 1. Calculate Skip Velocity over the last 3-4 events
  const recentWindow = history.slice(-4);
  let skipCount = 0;
  let rapidSkipCount = 0;
  for (const e of recentWindow) {
    if (e.action === 'skip') {
      skipCount++;
      if (typeof e.progress === 'number' && e.progress < 0.15) {
        rapidSkipCount++;
      } else if (typeof e.listenedSeconds === 'number' && e.listenedSeconds < 12) {
        rapidSkipCount++;
      }
    }
  }
  const skipVelocity = recentWindow.length > 0 ? (skipCount + rapidSkipCount) / (recentWindow.length * 1.5) : 0;

  // 2. Calculate Artist Concentration in recent history
  let maxArtistInWindow = 0;
  const windowArtistCounts = new Map<string, number>();
  for (const e of recentWindow) {
    if (e.artist && e.action !== 'skip') {
      const art = normalizeArtist(e.artist).primary;
      const c = (windowArtistCounts.get(art) || 0) + 1;
      windowArtistCounts.set(art, c);
      if (c > maxArtistInWindow) maxArtistInWindow = c;
    }
  }
  const artistConcentration = recentWindow.length > 0 ? maxArtistInWindow / recentWindow.length : 0;

  // 3. Resolve Intent
  let detectedIntent: SessionIntent = 'CHARTS_POPULAR';
  if (context.sessionIntent) {
    detectedIntent = context.sessionIntent;
  } else if (skipVelocity >= 0.55) {
    // User is rapidly skipping tracks → break the echo chamber and explore fresh tracks
    detectedIntent = 'ACTIVE_DISCOVERY';
  } else if (artistConcentration >= 0.6 || maxArtistInWindow >= 3) {
    // Deep artist listening streak
    detectedIntent = 'DEEP_FOCUS_ARTIST';
  } else if (moodCounts.size > 0 && Array.from(moodCounts.values()).some((v) => v > 1.5)) {
    // Dominant mood vibe
    detectedIntent = 'MOOD_FLOW';
  } else {
    detectedIntent = 'CHARTS_POPULAR';
  }

  const dynamicWeights = INTENT_WEIGHT_PROFILES[detectedIntent];
  const explorationRatios = INTENT_EXPLORATION_RATIOS[detectedIntent];

  // Determine dominant language
  let dominantLanguage: string | null = null;
  let maxLangScore = 0;
  for (const [lang, score] of Array.from(languageAffinities.entries())) {
    if (score > maxLangScore) {
      maxLangScore = score;
      dominantLanguage = lang;
    }
  }
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
    detectedIntent,
    dynamicWeights,
    explorationRatios,
    skipVelocity,
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

// ─── Novelty Score ──────────────────────────────────────────────
export function getNoveltyScore(
  trackId: string,
  canonicalKey: string | undefined,
  profile: SessionProfile
): number {
  const key = canonicalKey || trackId;
  const recency = profile.trackRecency.get(key);

  if (recency === undefined) return 1.0;
  if (recency <= 1)  return 0.05;
  if (recency <= 3)  return 0.15;
  if (recency <= 5)  return 0.30;
  if (recency <= 10) return 0.50;
  if (recency <= 20) return 0.70;
  return 0.85;
}

// ─── Language Affinity Score ────────────────────────────────────
export function getLanguageAffinityScore(
  candidateLanguage: string | undefined,
  targetLanguage: string,
  profile: SessionProfile
): number {
  if (!candidateLanguage) return 0.5;

  const candLang = candidateLanguage.toLowerCase();
  const target = targetLanguage.toLowerCase();

  if (target !== 'all' && candLang === target) return 1.0;
  if (profile.dominantLanguage && candLang === profile.dominantLanguage.toLowerCase()) return 0.9;

  const sessionScore = profile.languageAffinities.get(candLang);
  if (sessionScore && sessionScore > 0) return 0.7;

  if (target !== 'all' && candLang !== target) return 0.1;

  return 0.4;
}
