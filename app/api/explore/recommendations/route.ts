/**
 * POST /api/explore/recommendations
 * GET  /api/explore/recommendations (fallback)
 *
 * §20: API accepts currentTrack + sessionContext.
 * §21: Candidate pools are cached; personalized scoring is per-request.
 * §25: Structured observability is logged server-side.
 */

import { NextRequest, NextResponse } from 'next/server';
import { RecommendationEngine } from '@/lib/recommendation-engine';
import { SessionContext, RecommendationResponse, ListeningEvent } from '@/types/recommendation';
import { ExploreSong } from '@/types/explore';

export const dynamic = 'force-dynamic';

// ─── Input Validation & Sanitization (§20) ──────────────────────
// The backend must never blindly trust the client.
function sanitizeSessionContext(raw: any): SessionContext {
  const ctx: SessionContext = { recentHistory: [] };

  if (raw && typeof raw === 'object') {
    // Sanitize recentHistory — cap at 50 events, validate structure
    if (Array.isArray(raw.recentHistory)) {
      ctx.recentHistory = raw.recentHistory
        .slice(-50) // only last 50 events
        .filter((e: any) =>
          e && typeof e === 'object' &&
          typeof e.trackId === 'string' &&
          typeof e.action === 'string' &&
          ['play', 'skip', 'complete', 'replay', 'like'].includes(e.action) &&
          typeof e.timestamp === 'number'
        )
        .map((e: any): ListeningEvent => ({
          trackId: String(e.trackId).slice(0, 100),
          canonicalKey: e.canonicalKey ? String(e.canonicalKey).slice(0, 200) : undefined,
          artist: e.artist ? String(e.artist).slice(0, 200) : undefined,
          language: e.language ? String(e.language).slice(0, 30) : undefined,
          action: e.action,
          timestamp: Number(e.timestamp),
          progress: typeof e.progress === 'number' ? Math.max(0, Math.min(1, e.progress)) : undefined,
          listenedSeconds: typeof e.listenedSeconds === 'number' ? Math.max(0, e.listenedSeconds) : undefined,
        }));
    }

    if (typeof raw.activeLanguage === 'string') {
      ctx.activeLanguage = String(raw.activeLanguage).slice(0, 30);
    }
    if (typeof raw.currentMood === 'string') {
      ctx.currentMood = String(raw.currentMood).slice(0, 50);
    }
    if (typeof raw.currentArtist === 'string') {
      ctx.currentArtist = String(raw.currentArtist).slice(0, 200);
    }
    if (Array.isArray(raw.excludedTrackIds)) {
      ctx.excludedTrackIds = raw.excludedTrackIds
        .filter((id: any) => typeof id === 'string')
        .slice(0, 30)
        .map((id: string) => id.slice(0, 100));
    }
    if (Array.isArray(raw.excludedCanonicalKeys)) {
      ctx.excludedCanonicalKeys = raw.excludedCanonicalKeys
        .filter((k: any) => typeof k === 'string')
        .slice(0, 30)
        .map((k: string) => k.slice(0, 200));
    }
  }

  return ctx;
}

// ─── POST Handler (§20) ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const artist = typeof body.artist === 'string' ? body.artist.trim() : '';
    const language = typeof body.language === 'string' ? body.language.trim() : 'all';
    const limit = Math.min(Math.max(1, parseInt(body.limit) || 20), 30);

    if (!name && !artist) {
      return NextResponse.json(
        { success: false, message: 'Song name or artist required' },
        { status: 400 }
      );
    }

    // Sanitize session context — never trust raw client data
    const sessionContext = sanitizeSessionContext(body.sessionContext);

    // Delegate to engine — personalized scoring is always per-request (§21)
    const result: RecommendationResponse = await RecommendationEngine.getPersonalizedNext(
      name,
      artist,
      language,
      sessionContext,
      limit
    );

    // Return per-track results with scores, reasons, and features
    return NextResponse.json({
      success: true,
      ...result,
      // Also provide a flat songs array for backward compatibility
      songs: result.tracks.map(r => ({
        ...r.track,
        rankingMode: 'personalized' as const,
      })),
    });
  } catch (err: any) {
    console.error('[REC API ERROR]', err);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch recommendations', songs: [], tracks: [] },
      { status: 500 }
    );
  }
}

// ─── GET Handler (backward-compatible fallback) ─────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || '';
  const artist = searchParams.get('artist') || '';
  const language = searchParams.get('language') || 'all';
  const excludeId = searchParams.get('songId') || '';

  if (!name && !artist) {
    return NextResponse.json(
      { success: false, message: 'Song name or artist required' },
      { status: 400 }
    );
  }

  try {
    const sessionContext: SessionContext = {
      recentHistory: excludeId
        ? [{ trackId: excludeId, action: 'play', timestamp: Date.now() }]
        : [],
      excludedTrackIds: excludeId ? [excludeId] : [],
    };

    const result = await RecommendationEngine.getPersonalizedNext(
      name,
      artist,
      language,
      sessionContext,
      20
    );

    return NextResponse.json({
      success: true,
      ...result,
      songs: result.tracks.map(r => ({
        ...r.track,
        rankingMode: 'personalized' as const,
      })),
    });
  } catch (err: any) {
    console.error('[REC API ERROR]', err);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch recommendations', songs: [], tracks: [] },
      { status: 500 }
    );
  }
}
