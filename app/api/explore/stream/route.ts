import { NextRequest, NextResponse } from 'next/server';
import { resolveYouTubeStreamUrl, resolveSoundCloudStreamUrl } from '@/lib/multi-music';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('source');
  const idParam = request.nextUrl.searchParams.get('id');
  const urlParam = request.nextUrl.searchParams.get('url');

  let targetUrl: string | null = null;
  let customUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  try {
    const transcodeUrl = request.nextUrl.searchParams.get('transcodeUrl');

    if (source === 'youtube' && idParam) {
      targetUrl = await resolveYouTubeStreamUrl(decodeURIComponent(idParam));
      customUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    } else if (source === 'soundcloud') {
      const scTarget = transcodeUrl || urlParam;
      if (scTarget) {
        targetUrl = await resolveSoundCloudStreamUrl(decodeURIComponent(scTarget));
      }
    } else if (urlParam) {
      targetUrl = decodeURIComponent(urlParam);
    }

    if (!targetUrl) {
      return new NextResponse('Stream source not resolvable or missing parameters', { status: 400 });
    }

    // Forward range request headers if present
    const rangeHeader = request.headers.get('range') || 'bytes=0-';
    const headers: Record<string, string> = {
      'User-Agent': customUserAgent,
      'Range': rangeHeader,
    };

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
      return new NextResponse(`Upstream error: ${upstreamRes.statusText}`, {
        status: upstreamRes.status,
      });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', upstreamRes.headers.get('content-type') || 'audio/mp4');
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
