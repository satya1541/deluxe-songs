import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const videoId = searchParams.get('id')?.replace(/^yt_/, '').trim();

  const candidates: string[] = [];

  if (targetUrl) {
    let clean = decodeURIComponent(targetUrl).trim();
    if (clean.includes('googleusercontent.com')) {
      clean = clean.replace(/=w\d+-h\d+.*$/, '=w544-h544-l90-rj');
      if (!clean.includes('=w544-h544-l90-rj')) {
        clean = clean.replace(/=s\d+.*$/, '=w544-h544-l90-rj');
      }
    } else if (clean.includes('i.ytimg.com')) {
      clean = clean.replace(/\/(default|mqdefault|sddefault|hqdefault)\.jpg/, '/maxresdefault.jpg');
    }
    candidates.push(clean);
  }

  if (videoId) {
    candidates.push(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${videoId}/hq720.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`);
  }

  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        // Ensure it is actually an image and not an HTML error page
        if (contentType.startsWith('image/')) {
          const buffer = await res.arrayBuffer();
          // YouTube sometimes returns a 120-byte dummy placeholder if maxresdefault doesn't exist
          if (buffer.byteLength > 1000) {
            return new NextResponse(buffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=604800, immutable',
                'Access-Control-Allow-Origin': '*',
              },
            });
          }
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  return NextResponse.redirect(new URL(DEFAULT_FALLBACK, request.url));
}
