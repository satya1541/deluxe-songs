import { NextRequest, NextResponse } from 'next/server';
import { resolveYouTubeStreamUrl, resolveSoundCloudStreamUrl } from '@/lib/multi-music';

export const dynamic = 'force-dynamic';

export const HEAD = GET;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept-Encoding',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('source');
  const idParam = request.nextUrl.searchParams.get('id');
  const urlParam = request.nextUrl.searchParams.get('url');

  let targetUrl: string | null = null;
  let customUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  try {
    const transcodeUrl = request.nextUrl.searchParams.get('transcodeUrl');

    const clientRange = request.headers.get('range');
    console.log(`[STREAM REQ] source=${source} id=${idParam || 'none'} range=${clientRange || 'none'}`);

    const titleParam = request.nextUrl.searchParams.get('title');
    const artistParam = request.nextUrl.searchParams.get('artist');

    if (source === 'youtube') {
      const cleanId = idParam ? decodeURIComponent(idParam).replace(/^yt_/, '') : '';
      const isDirectYtId = /^[a-zA-Z0-9_-]{11}$/.test(cleanId);
      
      if (isDirectYtId) {
        targetUrl = await resolveYouTubeStreamUrl(cleanId);
      } else if (titleParam || artistParam) {
        // Resolve YouTube counterpart on demand
        try {
          const { searchYouTubeMusic } = await import('@/lib/multi-music');
          const searchRes = await searchYouTubeMusic(`${titleParam || ''} ${artistParam || ''}`.trim(), 1);
          if (searchRes.length > 0 && searchRes[0].id) {
            const resolvedYtId = searchRes[0].id.replace(/^yt_/, '');
            targetUrl = await resolveYouTubeStreamUrl(resolvedYtId);
          }
        } catch (ytResolveErr) {
          console.warn('On-demand YouTube resolution failed, checking fallback:', ytResolveErr);
        }
      }

      customUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      // Smart VPS Fallback: If YouTube is blocked by BotGuard (LOGIN_REQUIRED) on the server,
      // seamlessly resolve audio stream so audio NEVER fails!
      if (!targetUrl && (titleParam || artistParam)) {
        const searchQuery = `${titleParam || ''} ${artistParam || ''}`.trim();
        console.log(`[STREAM FALLBACK] Resolving audio fallback via JioSaavn for "${searchQuery}"...`);
        try {
          const { searchSaavnSongs } = await import('@/lib/saavn-stream');
          const results = await searchSaavnSongs(searchQuery, 1, 3);
          if (results.length > 0 && results[0].streamUrl) {
            const fallbackParams = new URL(results[0].streamUrl, 'http://localhost').searchParams;
            const directUrl = fallbackParams.get('url');
            if (directUrl) {
              targetUrl = directUrl;
              console.log(`[STREAM FALLBACK SUCCESS] Seamlessly streaming high-quality audio fallback for "${searchQuery}"!`);
            }
          }
        } catch (fallbackErr: any) {
          console.log(`[STREAM FALLBACK ERROR] Fallback failed: ${fallbackErr?.message}`);
        }
      }
    } else if (source === 'soundcloud') {
      const scTarget = transcodeUrl || urlParam;
      if (scTarget) {
        targetUrl = await resolveSoundCloudStreamUrl(decodeURIComponent(scTarget));
      }
    } else if (urlParam) {
      targetUrl = decodeURIComponent(urlParam);
    }

    if (!targetUrl) {
      console.log(`[STREAM ERROR] Target URL could not be resolved: source=${source} id=${idParam}`);
      return new NextResponse('Stream source not resolvable or missing parameters', { status: 400 });
    }

    const headers: Record<string, string> = {
      'User-Agent': customUserAgent,
    };
    if (clientRange) {
      headers['Range'] = clientRange;
    }

    const abortController = new AbortController();
    if (request.signal) {
      request.signal.addEventListener('abort', () => {
        try { abortController.abort(); } catch {}
      });
    }

    const upstreamRes = await fetch(targetUrl, {
      headers,
      signal: abortController.signal,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      console.log(`[STREAM UPSTREAM ERROR] Upstream status=${upstreamRes.status} statusText=${upstreamRes.statusText} targetUrl=${targetUrl.slice(0, 80)}...`);
      return new NextResponse(`Upstream error: ${upstreamRes.statusText}`, {
        status: upstreamRes.status,
      });
    }

    const responseHeaders = new Headers();
    let rawType = upstreamRes.headers.get('content-type') || 'audio/mp4';
    if (rawType.includes('video/mp4') || rawType.includes('application/octet-stream')) {
      rawType = 'audio/mp4';
    }
    responseHeaders.set('Content-Type', rawType);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Accept-Ranges', 'bytes');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    const etag = upstreamRes.headers.get('etag') || `"${source || 'track'}-${(idParam || urlParam || 'stream').slice(0, 32)}"`;
    responseHeaders.set('ETag', etag);
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    console.log(`[STREAM SERVED] Status=${upstreamRes.status} Range=${contentRange || 'none'} Type=${rawType}`);

    // Safely wrap upstream stream to handle client disconnects / seeks gracefully
    const bodyStream = new ReadableStream({
      async start(controller) {
        const reader = upstreamRes.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              try { controller.close(); } catch {}
              break;
            }
            controller.enqueue(value);
          }
        } catch (streamErr) {
          // Client aborted, sought elsewhere, or closed tab - clean exit without crash
          try { controller.close(); } catch {}
        } finally {
          try { reader.releaseLock(); } catch {}
        }
      },
      cancel() {
        try { abortController.abort(); } catch {}
      },
    });

    return new NextResponse(bodyStream, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return new NextResponse(null, { status: 499 });
    }
    console.error('Audio stream proxy error:', err);
    return new NextResponse('Failed to proxy audio stream', { status: 500 });
  }
}
