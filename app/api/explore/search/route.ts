import { NextResponse } from 'next/server';
import { searchMultiSource } from '@/lib/multi-music';
import { AudioSourcePlatform } from '@/types/explore';
import { parseSearchQuery, detectSearchIntent } from '@/lib/search-parser';
import { evaluateSearchResultQuality, generateTypoCorrection } from '@/lib/search-correction';
import { resolveTopResult, determineSectionOrdering } from '@/lib/search-orchestrator';
import { trackSearchEvent } from '@/lib/search-analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const startTime = Date.now();
  let query = '';
  let intent = null;
  let resultCount = 0;
  let eventType: any = 'search_submitted';

  try {
    const { searchParams } = new URL(request.url);
    query = searchParams.get('q') || '';
    const source = (searchParams.get('source') || searchParams.get('platform') || 'all') as 'all' | AudioSourcePlatform;
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    if (!query || !query.trim()) {
      return NextResponse.json({ success: true, songs: [], artists: [], albums: [] });
    }

    // 1. Query Understanding
    const parsedQuery = parseSearchQuery(query);
    const searchIntent = detectSearchIntent(parsedQuery);
    intent = searchIntent;

    // 2. Exact Retrieval (Use effective base query, modifiers like "songs" stripped out)
    const effectiveQuery = parsedQuery.baseQuery;
    let result = await searchMultiSource(effectiveQuery, source, Math.min(limit, 50));
    
    // 3. Typo Correction & Zero-Result Recovery
    let recoveryState = evaluateSearchResultQuality(query, result);
    
    // If we have zero/weak results, try typo correction
    let correctedQuery: string | undefined;
    if (recoveryState.state === 'C_ZERO' || recoveryState.state === 'B_WEAK') {
      const suggestedCorrection = generateTypoCorrection(effectiveQuery);
      if (suggestedCorrection) {
        // Run retrieval again with the corrected query
        const fallbackResult = await searchMultiSource(suggestedCorrection, source, Math.min(limit, 50));
        const fallbackRecovery = evaluateSearchResultQuality(suggestedCorrection, fallbackResult);
        
        if (fallbackRecovery.state === 'A_NORMAL' || fallbackRecovery.state === 'B_WEAK') {
          result = fallbackResult;
          correctedQuery = suggestedCorrection;
          eventType = 'search_corrected';
        } else {
          eventType = 'search_zero_results';
        }
      } else {
        eventType = 'search_zero_results';
      }
    }

    // 4. Entity Resolution & Canonical Matching (already partially handled in multi-music, but we could enforce more here if needed)
    // Note: Deduplication and basic entity ranking already occurs inside `searchMultiSource` -> `rankAndDiversifyCandidates`.

    // 5. Top Result Resolution
    const topResult = resolveTopResult(
      parsedQuery,
      searchIntent,
      result.artists || [],
      result.albums || [],
      result.songs || []
    );

    // 6. Intent-Aware Section Ordering
    const sectionOrdering = determineSectionOrdering(searchIntent);

    resultCount = (result.songs?.length || 0) + (result.artists?.length || 0) + (result.albums?.length || 0);

    // 7. Analytics Logging
    trackSearchEvent({
      event: eventType,
      query: query,
      intent: searchIntent.primary,
      latency: Date.now() - startTime,
      resultCount: resultCount
    });

    return NextResponse.json(
      {
        success: true,
        query,
        source,
        correctedQuery,
        intent: searchIntent,
        topResult,
        sections: sectionOrdering.sections,
        ...result
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in /api/explore/search:', error);
    trackSearchEvent({
      event: 'provider_failure',
      query: query,
      latency: Date.now() - startTime,
      error: error?.message
    });
    return NextResponse.json(
      { success: false, error: error?.message || 'Multi-source search failed' },
      { status: 500 }
    );
  }
}
