/**
 * Recommendation Engine — §3, §8, §9, §10, §19, §22, §25
 *
 * Orchestrates the full recommendation pipeline:
 *   Current Song → Session Context → Candidate Generation → Entity Resolution →
 *   Hard Filters → Feature Extraction → Deterministic Scoring → Negative Signals →
 *   Diversity Reranking → Exploration Mixing → Top 20 → Play Queue
 *
 * Three ranking modes:
 *   CHART:        Provider-authoritative, never re-ranked.
 *   DISCOVERY:    Multi-source + deterministic ranking.
 *   PERSONALIZED: Session-aware + behavioral scoring (this is the primary system).
 */

import {
  searchMultiSource,
  getTrendingMultiSource,
} from '@/lib/multi-music';
import { getInstantEmotion } from '@/lib/emotions';
import { ExploreSong, AudioSourcePlatform } from '@/types/explore';
import {
  SessionContext,
  RankingMode,
  RecommendationResult,
  RecommendationResponse,
} from '@/types/recommendation';
import {
  normalizeTitle,
  normalizeArtist,
  rankAndDiversifyCandidates,
  preserveAuthoritativeChartRanking,
  deduplicateCandidates,
  toCandidateTrack,
} from '@/lib/music-ranking';
import {
  scoreCandidates,
  applyDiversity,
  applyExplorationMix,
} from './music-ranking-scorer';
import { buildSessionProfile } from './session-profiler';

export class RecommendationEngine {
  /**
   * 1. CHART MODE (§28)
   * Source-authoritative rankings. Never algorithmically reorder official charts.
   */
  static async getChartTracks(
    language: string, 
    platform: 'all' | AudioSourcePlatform = 'jiosaavn', 
    limit: number = 30
  ): Promise<ExploreSong[]> {
    const rawTrending = await getTrendingMultiSource(language, platform, limit);
    return preserveAuthoritativeChartRanking(rawTrending, [], limit);
  }

  /**
   * 2. DISCOVERY MODE (§28)
   * Multi-source discovery and trend ranking. Candidates re-ranked deterministically.
   */
  static async getDiscoveryTracks(
    language: string,
    platform: 'all' | AudioSourcePlatform = 'all',
    limit: number = 30
  ): Promise<ExploreSong[]> {
    const rawTrending = await getTrendingMultiSource(language, platform, limit * 2);
    return rankAndDiversifyCandidates(rawTrending, language, limit);
  }

  /**
   * 3. PERSONALIZED / NEXT-SONG MODE (§3, §8, §19)
   * Full pipeline: candidates → resolution → filtering → scoring → diversity → exploration.
   */
  static async getPersonalizedNext(
    songName: string,
    songArtist: string,
    language: string,
    sessionContext: SessionContext,
    limit: number = 20
  ): Promise<RecommendationResponse> {
    const startTime = Date.now();

    // ── Emotion Detection (deterministic, no AI) ──
    const emotionData = getInstantEmotion(songName, songArtist);
    const currentMood = emotionData.emotion ? String(emotionData.emotion) : 'soft_romantic';

    // ── Build Session Profile ──
    const profile = buildSessionProfile(sessionContext);
    const primaryArtist = songArtist ? songArtist.split(/[,/&]/)[0].trim() : '';

    // ── Candidate Generation (§8): 4 strategies, 50–100 candidates ──
    const candidatePromises: Promise<ExploreSong[]>[] = [];

    // Strategy A — Same Artist (5–15 tracks)
    if (primaryArtist) {
      candidatePromises.push(
        searchMultiSource(primaryArtist, 'all', 15)
          .then(r => r.songs || [])
          .catch(() => [])
      );
    }

    // Strategy B — Session Continuation: use top session artists
    const topSessionArtists = this.getTopSessionArtists(profile, primaryArtist, 2);
    for (const artist of topSessionArtists) {
      candidatePromises.push(
        searchMultiSource(artist, 'all', 10)
          .then(r => r.songs || [])
          .catch(() => [])
      );
    }

    // Strategy C — Similar Artists: mood + language heuristic queries
    const heuristicQueries = this.buildHeuristicQueries(currentMood, primaryArtist, language);
    for (const query of heuristicQueries.slice(0, 2)) {
      candidatePromises.push(
        searchMultiSource(query, 'all', 15)
          .then(r => r.songs || [])
          .catch(() => [])
      );
    }

    // Strategy D — Trending/Discovery: authentic provider-backed candidates
    const trendingLang = profile.dominantLanguage || (language !== 'all' ? language : 'hindi');
    candidatePromises.push(
      getTrendingMultiSource(trendingLang, 'jiosaavn', 15).catch(() => [])
    );

    // Execute all strategies in parallel (§22)
    const results = await Promise.allSettled(candidatePromises);

    const allCandidates: ExploreSong[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allCandidates.push(...res.value);
      }
    }

    // ── Canonical Resolution (§9) ──
    // Use existing deduplicateCandidates to merge duplicates across providers
    const sourceRankCount: Record<string, number> = {};
    const candidateTracks = allCandidates.map(s => {
      const src = s.source || 'jiosaavn';
      sourceRankCount[src] = (sourceRankCount[src] || 0) + 1;
      return toCandidateTrack(s, sourceRankCount[src]);
    });
    const deduplicated = deduplicateCandidates(candidateTracks);

    // Convert back to ExploreSong for scorer
    const deduplicatedSongs: ExploreSong[] = deduplicated.map(track => ({
      id: track.id,
      name: track.title,
      artist: track.artists?.join(', ') || track.primaryArtist,
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
      canonicalKey: track.canonicalKey,
      availableSources: track.availableSources,
      sources: track.sources,
    } as any));

    const candidateCount = deduplicatedSongs.length;

    // ── Deterministic Scoring (§12) + Hard Filters (§11) + Negative Signals (§13) ──
    const scored = scoreCandidates(
      deduplicatedSongs,
      {
        ...sessionContext,
        currentMood,
        currentArtist: primaryArtist,
        excludedTrackIds: [
          ...(sessionContext.excludedTrackIds || []),
        ],
      },
      songName,
      songArtist,
      language,
      currentMood
    );

    // ── Exploration Mixing (§18) ──
    const mixed = applyExplorationMix(scored, limit * 2, profile);

    // ── Diversity Reranking (§17) ──
    const diversified = applyDiversity(mixed, limit);

    // ── Observability Logging (§25) ──
    const latencyMs = Date.now() - startTime;
    this.logRecommendations(diversified, candidateCount, latencyMs, songName, songArtist);

    // ── Construct Response (§19) ──
    return {
      tracks: diversified,
      rankingMode: 'personalized',
      emotion: {
        type: currentMood,
        label: emotionData.label,
        icon: emotionData.icon,
        color: emotionData.color,
        secondary: emotionData.secondary,
      },
      generatedAt: Date.now(),
      source: 'deterministic-authentic-engine',
      candidateCount,
      latencyMs,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────

  /**
   * Extract top session artists from profile (excluding current artist).
   */
  private static getTopSessionArtists(
    profile: ReturnType<typeof buildSessionProfile>,
    excludeArtist: string,
    count: number
  ): string[] {
    const excludeNorm = normalizeArtist(excludeArtist).primary;
    const entries: [string, number][] = [];

    for (const [artist, score] of Array.from(profile.artistAffinities.entries())) {
      if (score > 0 && artist !== excludeNorm) {
        entries.push([artist, score]);
      }
    }

    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, count).map(e => e[0]);
  }

  /**
   * Build heuristic search queries for similar-artist retrieval.
   * Uses mood + language signals rather than LLM invention.
   */
  private static buildHeuristicQueries(
    currentMood: string,
    primaryArtist: string,
    language: string
  ): string[] {
    const lang = language && language !== 'all' ? language : 'Hindi';
    const queries: string[] = [];

    // Mood-aligned query
    if (currentMood.includes('sad') || currentMood.includes('heartbreak')) {
      queries.push(`${lang} Sad Romantic Songs`);
    } else if (currentMood.includes('happy') || currentMood.includes('adoring')) {
      queries.push(`${lang} Romantic Dance Hits`);
    } else if (currentMood.includes('devotional') || currentMood.includes('sufi')) {
      queries.push(`${lang} Sufi Hits`);
    } else if (currentMood.includes('yearning') || currentMood.includes('nostalgic')) {
      queries.push(`${lang} Soulful Songs`);
    } else if (currentMood.includes('dreamy') || currentMood.includes('intimate')) {
      queries.push(`${lang} Lofi Romantic`);
    } else {
      queries.push(`${lang} Romantic Hits`);
    }

    // Language-genre query
    queries.push(`Top ${lang} Hits`);

    return queries;
  }

  /**
   * Structured observability logging (§25).
   * Logs top 5 recommendations with full scoring breakdown.
   */
  private static logRecommendations(
    results: RecommendationResult[],
    candidateCount: number,
    latencyMs: number,
    seedName: string,
    seedArtist: string
  ): void {
    console.log(`\n[REC ENGINE] ─── Recommendation Report ───`);
    console.log(`[REC ENGINE] Seed: "${seedName}" by "${seedArtist}"`);
    console.log(`[REC ENGINE] Candidates: ${candidateCount} → Final: ${results.length}`);
    console.log(`[REC ENGINE] Latency: ${latencyMs}ms`);

    const top = results.slice(0, 5);
    for (let i = 0; i < top.length; i++) {
      const r = top[i];
      const f = r.features;
      const reasonStr = r.reasons.map(
        rr => `${rr.score >= 0 ? '+' : ''}${rr.score.toFixed(2)} ${rr.type}${rr.explanation ? ` (${rr.explanation})` : ''}`
      ).join(', ');

      console.log(
        `[REC ENGINE] #${i + 1} ${r.track.name} — ${r.track.artist}\n` +
        `  score=${r.score.toFixed(3)} | ` +
        `sess=${f.sessionAffinity.toFixed(2)} art=${f.artistAffinity.toFixed(2)} ` +
        `lang=${f.languageAffinity.toFixed(2)} mood=${f.moodSimilarity.toFixed(2)} ` +
        `pop=${f.popularity.toFixed(2)} fresh=${f.freshness.toFixed(2)} ` +
        `novel=${f.novelty.toFixed(2)} qual=${f.audioQuality.toFixed(2)}\n` +
        `  reasons: [${reasonStr}]`
      );
    }
    console.log(`[REC ENGINE] ─── End Report ───\n`);
  }
}
