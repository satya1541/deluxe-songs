import { NextRequest, NextResponse } from 'next/server';
import { getSaavnAlbumDetails } from '@/lib/saavn-stream';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const albumId = params.id;
    if (!albumId) {
      return NextResponse.json({ success: false, error: 'Album ID required' }, { status: 400 });
    }

    const album = await getSaavnAlbumDetails(albumId);
    if (!album) {
      return NextResponse.json({ success: false, error: 'Album not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      album,
    });
  } catch (error: any) {
    console.error('API Error /api/explore/album/[id]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
