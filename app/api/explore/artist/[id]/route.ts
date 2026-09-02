import { NextRequest, NextResponse } from 'next/server';
import { getSaavnArtistDetails } from '@/lib/saavn-stream';
import { searchYouTubeMusic } from '@/lib/multi-music';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const artistId = params.id;
    if (!artistId) {
      return NextResponse.json({ success: false, error: 'Artist ID required' }, { status: 400 });
    }

    const artist = await getSaavnArtistDetails(artistId);
    if (!artist) {
      return NextResponse.json({ success: false, error: 'Artist not found' }, { status: 404 });
    }

    // Fetch Official Music Videos for this artist in parallel
    let videos: any[] = [];
    try {
      const cleanArtistName = artist.name.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
      videos = await searchYouTubeMusic(`${cleanArtistName} official video song`, 6);
    } catch (err) {
      console.warn('Could not fetch artist music videos:', err);
    }

    return NextResponse.json({
      success: true,
      artist: {
        ...artist,
        videos,
      },
    });
  } catch (error: any) {
    console.error('API Error /api/explore/artist/[id]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
