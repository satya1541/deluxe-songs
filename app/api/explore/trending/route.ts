import { NextResponse } from 'next/server';
import { RecommendationEngine } from '@/lib/recommendation-engine';
import { AudioSourcePlatform } from '@/types/explore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language') || 'all';
    const source = (searchParams.get('source') || searchParams.get('platform') || 'all') as 'all' | AudioSourcePlatform;
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    let songs: any[] = [];
    
    // Regional languages -> strict chart logic
    // 'all' -> discovery/trend logic
    if (language.toLowerCase() !== 'all') {
      songs = await RecommendationEngine.getChartTracks(language, source, Math.min(limit, 50));
    } else {
      songs = await RecommendationEngine.getDiscoveryTracks(language, source, Math.min(limit, 50));
    }

    return NextResponse.json(
      {
        success: true,
        language,
        source,
        count: songs.length,
        songs,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in /api/explore/trending:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch trending tracks' },
      { status: 500 }
    );
  }
}
