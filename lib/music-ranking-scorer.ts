/**
 * Deterministic Recommendation Scorer — Adaptive Multi-Signal Ranking
 *
 * Scores candidates using dynamic, situational feature weights.
 * Evaluates negative behavioral signals, diversity reranking, and dynamic exploration mixing.
 * Audio quality is decoupled from recommendation (delegated to playback stream resolver).
 * Every decision is explainable via per-track RecommendationResult metadata.
 */

import { ExploreSong } from '@/types/explore';
import {
  SessionContext,
  RecommendationResult,
  RecommendationReason,
  RecommendationFeatures,
  DynamicWeights,
  ExplorationMixRatio,
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

// ─── Diversity Config ───────────────────────────────────────────
const MAX_CONSECUTIVE_SAME_ARTIST   = 2;
const MAX_CONSECUTIVE_SAME_PROVIDER = 3;
const DIVERSITY_SCORE_THRESHOLD     = 0.15;

// ─── Hard Filters ───────────────────────────────────────────────
function isHardRejected(
  song: ExploreSong,
  currentSongName: string,
  currentSongId: string | undefined,
  profile: SessionProfile,
  excludedTrackIds: Set<string>,
  excludedCanonicalKeys: Set<string>
): boolean {
  // 1. Current song
  if (currentSongId && song.id === currentSongId) return true;

  // 2. Exact title match with current
  const titleNorm = normalizeTitle(song.name);
  const currTitleNorm = normalizeTitle(currentSongName);
  if (titleNorm && currTitleNorm && titleNorm === currTitleNorm) return true;

  // 3. Explicitly excluded
  if (excludedTrackIds.has(song.id)) return true;
  const canonKey = (song as any).canonicalKey;
  if (canonKey && excludedCanonicalKeys.has(canonKey)) return true;

  // 4. Junk, podcast, ringtone, compilation filtering
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

  // 1. Artist Affinity
  let artistAffinity = 0;
  if (artistNorm === currentArtistNorm && !!artistNorm) {
    artistAffinity = 0.9;
    reasons.push({ type: 'same_artist', score: artistAffinity, explanation: `Same artist: ${artistNorm}` });
  } else {
    const affinity = profile.artistAffinities.get(artistNorm);
    if (affinity !== undefined && affinity > 0) {
      artistAffinity = Math.min(affinity / 2.0, 0.8);
      reasons.push({ type: 'similar_artist', score: artistAffinity, explanation: `Historical affinity for ${artistNorm}` });
    }
  }

  // 2. Session Affinity — alignment with session trajectory
  let sessionAffinity = 0.3;
  if (profile.dominantLanguage && song.language?.toLowerCase() === profile.dominantLanguage.toLowerCase()) {
    sessionAffinity += 0.3;
  }
  if (profile.dominantMood) {
    const candidateMood = getInstantEmotion(song.name, song.artist).emotion;
    const moodSim = getMoodSimilarity(profile.dominantMood, candidateMood);
    sessionAffinity += moodSim * 0.25;
  }
  const artistHist = profile.artistAffinities.get(artistNorm);
  if (artistHist && artistHist > 0) {
    sessionAffinity += Math.min(artistHist * 0.2, 0.2);
  }
  sessionAffinity = Math.min(1.0, sessionAffinity);
  if (sessionAffinity > 0.5) {
    reasons.push({ type: 'session_affinity', score: sessionAffinity, explanation: 'Matches session direction' });
  }

  // 3. User Affinity
  const userAffinity = Math.min(1.0, (artistAffinity * 0.6) + (sessionAffinity * 0.4));

  // 4. Language Affinity
  const languageAffinity = getLanguageAffinityScore(song.language, currentLanguage, profile);
  if (languageAffinity > 0.7) {
    reasons.push({ type: 'language_affinity', score: languageAffinity, explanation: `Language match: ${song.language || 'unknown'}` });
  }

  // 5. Mood Similarity
  const candidateEmotion = getInstantEmotion(song.name, song.artist);
  const moodSimilarity = getMoodSimilarity(currentMood, candidateEmotion.emotion);
  if (moodSimilarity > 0.7) {
    reasons.push({ type: 'mood_similarity', score: moodSimilarity, explanation: `Mood alignment: ${candidateEmotion.emotion}` });
  }

  // 6. Popularity
  const popularity = song.source === 'jiosaavn' ? 0.6 : song.source === 'youtube' ? 0.5 : 0.3;

  // 7. Novelty
  const novelty = getNoveltyScore(song.id, (song as any).canonicalKey, profile);
  if (novelty > 0.8) {
    reasons.push({ type: 'novel', score: novelty, explanation: 'Not recently played' });
  }

  // 8. Freshness
  let freshness = 0.4;
  if (song.year) {
    const age = new Date().getFullYear() - parseInt(song.year);
    if (age <= 1) { freshness = 1.0; reasons.push({ type: 'fresh', score: 1.0, explanation: `Released ${song.year}` }); }
    else if (age <= 3) freshness = 0.8;
    else if (age <= 6) freshness = 0.6;
    else if (age <= 12) freshness = 0.4;
    else freshness = 0.2;
  }

  const features: RecommendationFeatures = {
    userAffinity,
    sessionAffinity,
    artistAffinity,
    languageAffinity,
    moodSimilarity,
    popularity,
    freshness,
    novelty,
  };

  return { features, reasons };
}

// ─── Dynamic Composite Score (Situation-Aware) ───────────────────
function computeCompositeScore(
  features: RecommendationFeatures,
  weights: DynamicWeights
): number {
  return (
    features.sessionAffinity  * weights.sessionAffinity +
    features.userAffinity     * weights.userAffinity +
    features.artistAffinity   * weights.artistAffinity +
    features.languageAffinity * weights.languageAffinity +
    features.moodSimilarity   * weights.moodSimilarity +
    features.popularity       * weights.popularity +
    features.novelty          * weights.novelty +
    features.freshness        * weights.freshness
  );
}

// ─── Negative Behavioral Signals with Hysteresis ────────────────
function applyNegativeSignals(
  score: number,
  song: ExploreSong,
  profile: SessionProfile,
  reasons: RecommendationReason[]
): number {
  const artistNorm = normalizeArtist(song.artist || '').primary;
  let adjusted = score;

  // 1. Recently skipped artist penalty (scaled with skip velocity)
  const skipPenalty = profile.skippedArtistPenalties.get(artistNorm);
  if (skipPenalty && skipPenalty > 0) {
    const penaltyMultiplier = profile.skipVelocity > 0.5 ? 0.25 : 0.15;
    const penalty = Math.min(skipPenalty * penaltyMultiplier, 0.30);
    adjusted -= penalty;
    reasons.push({ type: 'session_affinity', score: -penalty, explanation: `Skip penalty for ${artistNorm}` });
  }

  // 2. Overexposure penalty (artist appearing too many times in recent queue)
  const artistCount = profile.recentArtistCounts.get(artistNorm) || 0;
  if (artistCount >= 3) {
    const overexposurePenalty = Math.min((artistCount - 2) * 0.08, 0.20);
    adjusted -= overexposurePenalty;
    reasons.push({ type: 'session_affinity', score: -overexposurePenalty, explanation: `Overexposure penalty for ${artistNorm}` });
  }

  // 3. Recently played exact track penalty (strong novelty penalty)
  if (profile.recentTrackIds.has(song.id)) {
    adjusted -= 0.35;
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
  const currentSongId = sessionContext.excludedTrackIds?.[0];
  const excludedIds = new Set(sessionContext.excludedTrackIds || []);
  const excludedKeys = new Set(sessionContext.excludedCanonicalKeys || []);

  const results: RecommendationResult[] = [];
  const seenTitles = new Set<string>();

  for (const song of candidates) {
    // 1. Hard filter
    if (isHardRejected(song, currentSongName, currentSongId, profile, excludedIds, excludedKeys)) {
      continue;
    }

    // 2. Deduplicate within candidate pool
    const dedupeKey = `${normalizeTitle(song.name)}___${normalizeArtist(song.artist || '').primary}`;
    if (seenTitles.has(dedupeKey)) continue;
    seenTitles.add(dedupeKey);

    // 3. Extract features
    const { features, reasons } = extractFeatures(
      song,
      currentSongArtist,
      currentLanguage,
      currentMood,
      profile
    );

    // 4. Compute composite score with dynamic situational weights
    const rawScore = computeCompositeScore(features, profile.dynamicWeights);

    // 5. Apply negative behavioral signals
    const finalScore = applyNegativeSignals(rawScore, song, profile, reasons);

    results.push({
      track: song,
      score: Math.round(finalScore * 1000) / 1000,
      reasons,
      features,
    });
  }

  // Sort descending by final score
  results.sort((a, b) => b.score - a.score);

  return results;
}

// ─── Diversity Reranker ─────────────────────────────────────────
export function applyDiversity(scored: RecommendationResult[], limit: number): RecommendationResult[] {
  if (scored.length <= 1) return scored;

  const result: RecommendationResult[] = [];
  const remaining = [...scored];

  let consecutiveArtistCount = 0;
  let lastArtist: string | null = null;
  let consecutiveProviderCount = 0;
  let lastProvider: string | null = null;

  while (result.length < limit && remaining.length > 0) {
    let bestIdx = 0;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const artist = normalizeArtist(candidate.track.artist || '').primary;
      const provider = candidate.track.source || 'jiosaavn';

      const wouldViolateArtist = (artist === lastArtist && consecutiveArtistCount >= MAX_CONSECUTIVE_SAME_ARTIST);
      const wouldViolateProvider = (provider === lastProvider && consecutiveProviderCount >= MAX_CONSECUTIVE_SAME_PROVIDER);

      if (!wouldViolateArtist && !wouldViolateProvider) {
        bestIdx = i;
        break;
      }

      const scoreDelta = (remaining[0].score - candidate.score);
      if (scoreDelta > DIVERSITY_SCORE_THRESHOLD) {
        bestIdx = 0;
        break;
      }
    }

    const [chosen] = remaining.splice(bestIdx, 1);
    const chosenArtist = normalizeArtist(chosen.track.artist || '').primary;
    const chosenProvider = chosen.track.source || 'jiosaavn';

    if (chosenArtist === lastArtist) {
      consecutiveArtistCount++;
    } else {
      consecutiveArtistCount = 1;
      lastArtist = chosenArtist;
    }

    if (chosenProvider === lastProvider) {
      consecutiveProviderCount++;
    } else {
      consecutiveProviderCount = 1;
      lastProvider = chosenProvider;
    }

    result.push(chosen);
  }

  return result;
}

// ─── Adaptive Exploration Mixer ─────────────────────────────────
export function applyExplorationMix(
  scored: RecommendationResult[],
  limit: number,
  profile: SessionProfile
): RecommendationResult[] {
  if (scored.length <= limit) return scored;

  const ratios = profile.explorationRatios;
  const exploitCount   = Math.ceil(limit * ratios.exploitation);
  const exploreCount   = Math.ceil(limit * ratios.exploration);
  const discoveryCount = Math.max(1, limit - exploitCount - exploreCount);

  const exploitation: RecommendationResult[] = [];
  const exploration: RecommendationResult[] = [];
  const discovery: RecommendationResult[] = [];

  const minRelevanceThreshold = scored.length > 0 ? scored[0].score * 0.25 : 0;

  for (const item of scored) {
    if (item.score < minRelevanceThreshold) continue;

    const artistNorm = normalizeArtist(item.track.artist || '').primary;
    const hasArtistHistory = profile.artistAffinities.has(artistNorm);
    const isHighNovelty = item.features.novelty > 0.75;

    if (hasArtistHistory && !isHighNovelty) {
      exploitation.push(item);
    } else if (hasArtistHistory || item.features.languageAffinity > 0.5) {
      exploration.push(item);
    } else {
      discovery.push(item);
    }
  }

  const final: RecommendationResult[] = [];

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

  // Pad if needed
  if (final.length < limit) {
    for (const item of scored) {
      if (final.length >= limit) break;
      if (!final.find(f => f.track.id === item.track.id)) {
        final.push(item);
      }
    }
  }

  return final;
}
