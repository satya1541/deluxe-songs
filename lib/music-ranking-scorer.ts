/**
 * Deterministic Recommendation Scorer — §12, §13, §17, §18
 *
 * Scores candidates using weighted feature composition.
 * Applies negative behavioral signals, diversity reranking, and exploration mixing.
 * Every decision is explainable via per-track RecommendationResult metadata.
 */

import { ExploreSong } from '@/types/explore';
import {
  SessionContext,
  RecommendationResult,
  RecommendationReason,
  RecommendationFeatures,
} from '@/types/recommendation';
import { normalizeTitle, normalizeArtist, isCleanTrack, toCandidateTrack } from './music-ranking';
import {
  buildSessionProfile,
  SessionProfile,
  getMoodSimilarity,
  getNoveltyScore,
  getLanguageAffinityScore,
} from './session-profiler';
import { getInstantEmotion } from './emotions';

// ─── Configurable Weights (§12) ─────────────────────────────────
// Normalized features × weights = composite score.
export const SCORING_WEIGHTS = {
  sessionAffinity:  0.24,
  userAffinity:     0.20,
  artistAffinity:   0.15,
  languageAffinity: 0.12,
  moodSimilarity:   0.08,
  popularity:       0.07,
  novelty:          0.06,
  freshness:        0.05,
  audioQuality:     0.03,
};

// ─── Exploration Ratios (§18) ───────────────────────────────────
const EXPLOITATION_RATIO = 0.70;
const EXPLORATION_RATIO  = 0.20;
const DISCOVERY_RATIO    = 0.10;

// ─── Diversity Config (§17) ─────────────────────────────────────
const MAX_CONSECUTIVE_SAME_ARTIST   = 2;
const MAX_CONSECUTIVE_SAME_PROVIDER = 3;
const DIVERSITY_SCORE_THRESHOLD     = 0.15; // Only swap within this score delta

// ─── Hard Filters (§11) ─────────────────────────────────────────
function isHardRejected(
  song: ExploreSong,
  currentSongName: string,
  currentSongId: string | undefined,
  profile: SessionProfile,
  excludedTrackIds: Set<string>,
  excludedCanonicalKeys: Set<string>
): boolean {
  // Current song
  if (currentSongId && song.id === currentSongId) return true;

  // Exact title match with current
  const titleNorm = normalizeTitle(song.name);
  const currTitleNorm = normalizeTitle(currentSongName);
  if (titleNorm && currTitleNorm && titleNorm === currTitleNorm) return true;

  // Explicitly excluded
  if (excludedTrackIds.has(song.id)) return true;
  const canonKey = (song as any).canonicalKey;
  if (canonKey && excludedCanonicalKeys.has(canonKey)) return true;

  // Use existing isCleanTrack for junk/podcast/ringtone/compilation filtering
  const candidate = toCandidateTrack(song, 1);
  if (!isCleanTrack(candidate)) return true;

  return false;
}

// ─── Feature Extraction ─────────────────────────────────────────

function extractFeatures(
  song: ExploreSong,
  currentArtist: string,
  currentLanguage: string,
  currentMood: string | null,
  profile: SessionProfile
): { features: RecommendationFeatures; reasons: RecommendationReason[] } {
  const reasons: RecommendationReason[] = [];
  const artistNorm = normalizeArtist(song.artist || '').primary;
  const currentArtistNorm = normalizeArtist(currentArtist).primary;

  // 1. Artist Affinity (§5)
  let artistAffinity = 0;
  if (artistNorm === currentArtistNorm && !!artistNorm) {
    artistAffinity = 0.9;
    reasons.push({ type: 'same_artist', score: artistAffinity, explanation: `Same artist: ${artistNorm}` });
  } else {
    const affinity = profile.artistAffinities.get(artistNorm);
    if (affinity !== undefined && affinity > 0) {
      artistAffinity = Math.min(affinity / 2.0, 0.8); // normalize, cap at 0.8
      reasons.push({ type: 'similar_artist', score: artistAffinity, explanation: `Historical affinity for ${artistNorm}` });
    }
  }

  // 2. Session Affinity — how much does this track align with the session's direction?
  let sessionAffinity = 0.3; // baseline
  if (profile.dominantLanguage && song.language?.toLowerCase() === profile.dominantLanguage.toLowerCase()) {
    sessionAffinity += 0.3;
  }
  if (profile.dominantMood) {
    const candidateMood = getInstantEmotion(song.name, song.artist).emotion;
    const moodSim = getMoodSimilarity(profile.dominantMood, candidateMood);
    sessionAffinity += moodSim * 0.2;
  }
  // Boost if artist has positive history
  const artistHist = profile.artistAffinities.get(artistNorm);
  if (artistHist && artistHist > 0) {
    sessionAffinity += Math.min(artistHist * 0.2, 0.2);
  }
  sessionAffinity = Math.min(1.0, sessionAffinity);
  if (sessionAffinity > 0.5) {
    reasons.push({ type: 'session_affinity', score: sessionAffinity, explanation: 'Matches session direction' });
  }

  // 3. User Affinity (combination of artist + session)
  const userAffinity = Math.min(1.0, (artistAffinity * 0.6) + (sessionAffinity * 0.4));

  // 4. Language Affinity (§16)
  const languageAffinity = getLanguageAffinityScore(song.language, currentLanguage, profile);
  if (languageAffinity > 0.7) {
    reasons.push({ type: 'language_affinity', score: languageAffinity, explanation: `Language match: ${song.language || 'unknown'}` });
  }

  // 5. Mood Similarity (§15)
  const candidateEmotion = getInstantEmotion(song.name, song.artist);
  const moodSimilarity = getMoodSimilarity(currentMood, candidateEmotion.emotion);
  if (moodSimilarity > 0.7) {
    reasons.push({ type: 'mood_similarity', score: moodSimilarity, explanation: `Mood: ${candidateEmotion.emotion}` });
  }

  // 6. Popularity (§12) — proxy via provider rank or default
  const popularity = song.source === 'jiosaavn' ? 0.6 : song.source === 'youtube' ? 0.5 : 0.3;

  // 7. Novelty (§14)
  const novelty = getNoveltyScore(song.id, (song as any).canonicalKey, profile);
  if (novelty > 0.8) {
    reasons.push({ type: 'novel', score: novelty, explanation: 'Not recently played' });
  }

  // 8. Freshness (§12)
  let freshness = 0.4;
  if (song.year) {
    const age = new Date().getFullYear() - parseInt(song.year);
    if (age <= 1) { freshness = 1.0; reasons.push({ type: 'fresh', score: 1.0, explanation: `Released ${song.year}` }); }
    else if (age <= 3) freshness = 0.8;
    else if (age <= 6) freshness = 0.6;
    else if (age <= 12) freshness = 0.4;
    else freshness = 0.2;
  }

  // 9. Audio Quality (§10 — small feature, primarily for source selection)
  let audioQuality = 0.5;
  if (song.quality === '320kbps') audioQuality = 1.0;
  else if (song.quality === '160kbps') audioQuality = 0.7;
  else if (song.quality === '128kbps') audioQuality = 0.5;

  const features: RecommendationFeatures = {
    userAffinity,
    sessionAffinity,
    artistAffinity,
    languageAffinity,
    moodSimilarity,
    popularity,
    freshness,
    novelty,
    audioQuality,
  };

  return { features, reasons };
}

// ─── Composite Score (§12) ──────────────────────────────────────
function computeCompositeScore(features: RecommendationFeatures): number {
  return (
    features.sessionAffinity  * SCORING_WEIGHTS.sessionAffinity +
    features.userAffinity     * SCORING_WEIGHTS.userAffinity +
    features.artistAffinity   * SCORING_WEIGHTS.artistAffinity +
    features.languageAffinity * SCORING_WEIGHTS.languageAffinity +
    features.moodSimilarity   * SCORING_WEIGHTS.moodSimilarity +
    features.popularity       * SCORING_WEIGHTS.popularity +
    features.novelty          * SCORING_WEIGHTS.novelty +
    features.freshness        * SCORING_WEIGHTS.freshness +
    features.audioQuality     * SCORING_WEIGHTS.audioQuality
  );
}

// ─── Negative Behavioral Signals (§13) ──────────────────────────
function applyNegativeSignals(
  score: number,
  song: ExploreSong,
  profile: SessionProfile,
  reasons: RecommendationReason[]
): number {
  const artistNorm = normalizeArtist(song.artist || '').primary;
  let adjusted = score;

  // Recently skipped artist → penalty
  const skipPenalty = profile.skippedArtistPenalties.get(artistNorm);
  if (skipPenalty && skipPenalty > 0) {
    const penalty = Math.min(skipPenalty * 0.15, 0.25); // Cap penalty
    adjusted -= penalty;
    reasons.push({ type: 'session_affinity', score: -penalty, explanation: `Skip penalty for ${artistNorm}` });
  }

  // Overexposure — if artist already appears many times in recent history
  const artistCount = profile.recentArtistCounts.get(artistNorm) || 0;
  if (artistCount >= 3) {
    const overexposurePenalty = Math.min((artistCount - 2) * 0.05, 0.15);
    adjusted -= overexposurePenalty;
  }

  // Recently played exact track — strong novelty penalty
  if (profile.recentTrackIds.has(song.id)) {
    adjusted -= 0.20;
  }

  return Math.max(0.01, adjusted);
}

// ─── Main Scoring Entry Point ───────────────────────────────────
export function scoreCandidates(
  candidates: ExploreSong[],
  sessionContext: SessionContext,
  currentSongName: string,
  currentSongArtist: string,
  currentLanguage: string,
  currentMood: string | null
): RecommendationResult[] {
  const profile = buildSessionProfile(sessionContext);
  const currentSongId = sessionContext.excludedTrackIds?.[0]; // First excluded is typically the current track
  const excludedIds = new Set(sessionContext.excludedTrackIds || []);
  const excludedKeys = new Set(sessionContext.excludedCanonicalKeys || []);

  // Merge recent track IDs into excluded set
  // (but don't hard-reject — let novelty scoring handle it softly for most)
  
  const results: RecommendationResult[] = [];
  const seenTitles = new Set<string>();

  for (const song of candidates) {
    // Hard filter
    if (isHardRejected(song, currentSongName, currentSongId, profile, excludedIds, excludedKeys)) {
      continue;
    }

    // Deduplicate within candidate pool (same normalized title + artist)
    const dedupeKey = `${normalizeTitle(song.name)}___${normalizeArtist(song.artist || '').primary}`;
    if (seenTitles.has(dedupeKey)) continue;
    seenTitles.add(dedupeKey);

    // Extract features
    const { features, reasons } = extractFeatures(
      song,
      currentSongArtist,
      currentLanguage,
      currentMood,
      profile
    );

    // Composite score
    let score = computeCompositeScore(features);

    // Apply negative behavioral signals
    score = applyNegativeSignals(score, song, profile, reasons);

    results.push({ track: song, score, reasons, features });
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);
  return results;
}

// ─── Diversity Reranking (§17) ──────────────────────────────────
// Soft presentation constraints. Never promote a terrible candidate
// far above a highly relevant one.
export function applyDiversity(scored: RecommendationResult[], limit: number): RecommendationResult[] {
  if (scored.length === 0) return [];

  const result: RecommendationResult[] = [];
  const remaining = [...scored];
  let lastArtist: string | null = null;
  let consecutiveArtist = 0;
  let lastProvider: string | null = null;
  let consecutiveProvider = 0;

  while (remaining.length > 0 && result.length < limit) {
    let selectedIdx = 0;
    const topScore = remaining[0].score;

    // Check if we need to diversify
    const topArtist = normalizeArtist(remaining[0].track.artist || '').primary;
    const topProvider = remaining[0].track.source || 'jiosaavn';

    const needsArtistDiversity = topArtist === lastArtist && consecutiveArtist >= MAX_CONSECUTIVE_SAME_ARTIST;
    const needsProviderDiversity = topProvider === lastProvider && consecutiveProvider >= MAX_CONSECUTIVE_SAME_PROVIDER;

    if (needsArtistDiversity || needsProviderDiversity) {
      // Find the highest-scoring alternative within the score threshold
      for (let i = 1; i < remaining.length; i++) {
        const delta = topScore - remaining[i].score;
        if (delta > DIVERSITY_SCORE_THRESHOLD) break; // Too much score sacrifice

        const candidateArtist = normalizeArtist(remaining[i].track.artist || '').primary;
        const candidateProvider = remaining[i].track.source || 'jiosaavn';

        const artistOk = !needsArtistDiversity || candidateArtist !== lastArtist;
        const providerOk = !needsProviderDiversity || candidateProvider !== lastProvider;

        if (artistOk && providerOk) {
          selectedIdx = i;
          break;
        }
      }
      // If no alternative found within threshold, take the top anyway
    }

    const selected = remaining.splice(selectedIdx, 1)[0];
    const selectedArtist = normalizeArtist(selected.track.artist || '').primary;
    const selectedProvider = selected.track.source || 'jiosaavn';

    // Update consecutive counters
    if (selectedArtist === lastArtist) {
      consecutiveArtist++;
    } else {
      lastArtist = selectedArtist;
      consecutiveArtist = 1;
    }

    if (selectedProvider === lastProvider) {
      consecutiveProvider++;
    } else {
      lastProvider = selectedProvider;
      consecutiveProvider = 1;
    }

    result.push(selected);
  }

  return result;
}

// ─── Exploration Mixer (§18) ────────────────────────────────────
// The queue should not become an echo chamber.
// Reserves configurable portions for exploration and discovery.
export function applyExplorationMix(
  scored: RecommendationResult[],
  limit: number,
  profile: SessionProfile
): RecommendationResult[] {
  if (scored.length <= limit) return scored;

  const exploitCount    = Math.ceil(limit * EXPLOITATION_RATIO);
  const exploreCount    = Math.ceil(limit * EXPLORATION_RATIO);
  const discoveryCount  = Math.max(1, limit - exploitCount - exploreCount);

  const exploitation: RecommendationResult[] = [];
  const exploration: RecommendationResult[] = [];
  const discovery: RecommendationResult[] = [];

  // Minimum relevance threshold for exploration
  const minRelevanceThreshold = scored.length > 0 ? scored[0].score * 0.3 : 0;

  for (const item of scored) {
    if (item.score < minRelevanceThreshold) continue;

    const artistNorm = normalizeArtist(item.track.artist || '').primary;
    const hasArtistHistory = profile.artistAffinities.has(artistNorm);
    const isHighNovelty = item.features.novelty > 0.8;

    if (hasArtistHistory && !isHighNovelty) {
      // Exploitation: known artist, recently played
      exploitation.push(item);
    } else if (hasArtistHistory || item.features.languageAffinity > 0.5) {
      // Exploration: related but novel
      exploration.push(item);
    } else {
      // Discovery: unfamiliar territory
      discovery.push(item);
    }
  }

  const final: RecommendationResult[] = [];

  // Take from each bucket
  for (const item of exploitation) {
    if (final.length >= exploitCount) break;
    final.push(item);
  }
  for (const item of exploration) {
    if (final.length >= exploitCount + exploreCount) break;
    if (!final.find(f => f.track.id === item.track.id)) {
      final.push(item);
    }
  }
  for (const item of discovery) {
    if (final.length >= limit) break;
    if (!final.find(f => f.track.id === item.track.id)) {
      final.push(item);
    }
  }

  // If we don't have enough, pad from scored
  if (final.length < limit) {
    for (const item of scored) {
      if (final.length >= limit) break;
      if (!final.find(f => f.track.id === item.track.id)) {
        final.push(item);
      }
    }
  }

  // Re-sort final by score for consistent ordering
  final.sort((a, b) => b.score - a.score);
  return final;
}
