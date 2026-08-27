import { NextResponse } from 'next/server';
import { searchMultiSource } from '@/lib/multi-music';
import { AudioSourcePlatform } from '@/types/explore';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const source = (searchParams.get('source') || searchParams.get('platform') || 'all') as 'all' | AudioSourcePlatform;
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    if (!query || !query.trim()) {
      return NextResponse.json({ success: true, songs: [] });
    }

    const songs = await searchMultiSource(query.trim(), source, Math.min(limit, 50));

    return NextResponse.json(
      {
        success: true,
        query,
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
    console.error('Error in /api/explore/search:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Multi-source search failed' },
      { status: 500 }
    );
  }
}
