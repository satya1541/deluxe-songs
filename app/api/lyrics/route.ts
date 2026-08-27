import { NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { LyricLine, LyricsData } from '@/types/lyrics';

// In-memory runtime cache
const lyricsMemoryCache = new Map<string, LyricsData>();

export const dynamic = 'force-dynamic';

function cleanMetadataString(str: string): string {
  if (!str) return '';
  return str
    .replace(/\.mp3$/i, '')
    .replace(/\b(320|128|192|256|64)\s*kbps\b/gi, '')
    .replace(/\b(pendujatt|pagalworld|pagalnew|mr-jatt|djpunjab|naasongs|songspk|djmaza|bestwap|hungama|wynk|gaana|jiosaavn|spotify|itunes|apple|youtube|remix|mashup)\b[.\w]*/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*remix[^)]*\)/gi, '')
    .replace(/\([^)]*lyrics[^)]*\)/gi, '')
    .replace(/\([^)]*official[^)]*\)/gi, '')
    .replace(/\([^)]*video[^)]*\)/gi, '')
    .replace(/\([^)]*audio[^)]*\)/gi, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPrimaryArtist(artistStr: string): string {
  if (!artistStr) return '';
  const primary = artistStr.split(/[,&/]|(\b(feat|ft|and)\b)/i)[0].trim();
  return primary || artistStr.trim();
}

function isDisallowedCandidate(candidateTitle: string, candidateArtist: string, targetTitle: string): boolean {
  const cTitle = (candidateTitle || '').toLowerCase();
  const cArtist = (candidateArtist || '').toLowerCase();
  const tTitle = (targetTitle || '').toLowerCase();

  // Disallow mashups, covers, or multi-song mashups unless explicitly requested
  if (!tTitle.includes('mashup') && (cTitle.includes('mashup') || cArtist.includes('mashup') || (cTitle.includes('&') && cTitle.length > tTitle.length + 5))) {
    return true;
  }
  if (!tTitle.includes('cover') && cTitle.includes('cover')) {
    return true;
  }
  if (!tTitle.includes('remix') && cTitle.includes('remix')) {
    return true;
  }
  return false;
}

function evaluateScriptPreference(text: string): number {
  if (!text) return 0;
  // Reject scripts that typical users cannot read (Urdu/Arabic, Gurmukhi, Bengali, Tamil, Telugu, etc.)
  const hasDisallowedScript = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u0A00-\u0A7F\u0980-\u09FF\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/.test(
    text
  );

  if (hasDisallowedScript) {
    return -80; // Heavy penalty so Romanized Hinglish or Devanagari Hindi is picked
  }

  // Latin / English / Hinglish (Preferred by users)
  if (/[a-zA-Z]/.test(text)) {
    return 40;
  }

  // Standard Devanagari Hindi
  if (/[\u0900-\u097F]/.test(text)) {
    return 30;
  }

  return 0;
}

// 4-Point Strict Matching: Song Name (40pts) + Artist (30pts) + Duration (30pts) + Script (Hinglish/Hindi/English) (40pts)
function computeMatchScore(
  candidate: { trackName?: string; name?: string; artistName?: string; artists?: any[]; duration?: number; dt?: number; syncedLyrics?: string; plainLyrics?: string },
  targetTitle: string,
  targetArtist: string,
  targetDuration: number
): number {
  const cTitle = (candidate.trackName || candidate.name || '').toLowerCase().trim();
  const tTitle = targetTitle.toLowerCase().trim();

  let cArtist = (
    candidate.artistName ||
    (Array.isArray(candidate.artists) ? candidate.artists.map((a: any) => (typeof a === 'string' ? a : a.name)).join(' ') : '') ||
    ''
  ).toLowerCase().trim();
  const tArtist = targetArtist.toLowerCase().trim();
  const tPrimaryArtist = getPrimaryArtist(targetArtist).toLowerCase().trim();

  const cDur = candidate.duration || (candidate.dt ? candidate.dt / 1000 : 0);

  // 0. Disallow mashups, covers, or multi-song mashups unless explicitly requested
  if (isDisallowedCandidate(cTitle, cArtist, targetTitle)) {
    return -1000;
  }

  let score = 0;

  // 1. Song Name Match (Must match core title)
  if (cTitle === tTitle) {
    score += 40;
  } else if (cTitle.includes(tTitle) || tTitle.includes(cTitle)) {
    score += 25;
  } else {
    return -1000;
  }

  // 2. Strict Artist Verification (Precaution against same title by different singers)
  // Split target artists into tokens (e.g. "Mithoon", "Altamash Faridi", "Tulsi Kumar")
  const targetArtistTokens = tArtist
    .split(/[,&/]|(\b(feat|ft|and)\b)/i)
    .map((s) => (s || '').trim().toLowerCase())
    .filter((s) => s.length > 2);

  const hasArtistOverlap =
    targetArtistTokens.length === 0 ||
    targetArtistTokens.some((token) => cArtist.includes(token) || token.includes(cArtist)) ||
    (tPrimaryArtist && (cArtist.includes(tPrimaryArtist) || tPrimaryArtist.includes(cArtist)));

  if (hasArtistOverlap) {
    score += 35;
  } else if (tArtist) {
    // If target has specific artists and candidate matches NONE of them, REJECT candidate!
    // (This prevents Armaan Malik version from matching Altamash Faridi & Tulsi Kumar version)
    return -1000;
  }

  // 3. Duration Match (Critical for Sync)
  if (targetDuration > 0 && cDur > 0) {
    const diff = Math.abs(cDur - targetDuration);
    if (diff <= 5) {
      score += 30; // Exact length match (within 5s)
    } else if (diff <= 12) {
      score += 20; // Close length match (within 12s)
    } else if (diff <= 25) {
      score += 5;
    } else {
      score -= 40; // Heavy penalty for cut/short versions
    }
  }

  // 4. Script Preference: Hinglish / Latin / Hindi Devanagari vs unreadable scripts
  const sampleLyricsText = candidate.syncedLyrics || candidate.plainLyrics || '';
  score += evaluateScriptPreference(sampleLyricsText);

  // Bonus for synchronized .lrc availability
  if (candidate.syncedLyrics && candidate.syncedLyrics.length > 10) {
    score += 15;
  }

  return score;
}

function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];

  const lines = lrcText.split(/\r?\n/);
  const parsedLines: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Ignore metadata header tags
    if (
      trimmed.includes('作词') ||
      trimmed.includes('作曲') ||
      trimmed.includes('编曲') ||
      trimmed.includes('制作') ||
      trimmed.includes('Written by') ||
      trimmed.includes('Produced by') ||
      trimmed.includes('Lyrics by') ||
      trimmed.includes('Music by') ||
      trimmed.startsWith('[ti:') ||
      trimmed.startsWith('[ar:') ||
      trimmed.startsWith('[al:') ||
      trimmed.startsWith('[by:')
    ) {
      continue;
    }

    timeRegex.lastIndex = 0;
    const matches = Array.from(trimmed.matchAll(timeRegex));
    if (matches.length === 0) continue;

    const text = trimmed.replace(timeRegex, '').trim();
    if (!text) continue;

    for (const match of matches) {
      const mins = parseInt(match[1], 10) || 0;
      const secs = parseInt(match[2], 10) || 0;
      let fractional = 0;
      if (match[3]) {
        fractional = match[3].length === 2 ? parseInt(match[3], 10) / 100 : parseInt(match[3], 10) / 1000;
      }
      const totalSeconds = parseFloat((mins * 60 + secs + fractional).toFixed(2));
      parsedLines.push({
        time: totalSeconds,
        text,
      });
    }
  }

  parsedLines.sort((a, b) => a.time - b.time);
  return parsedLines;
}

// Provider 1: LRCLIB (Primary Synced Database with 3-Point Strict Scoring)
async function fetchLrclib(
  cleanTrack: string,
  cleanArtist: string,
  primaryArtist: string,
  durationSec: number
): Promise<LyricsData | null> {
  // 1. Try Exact Track + Artist + Duration Match first
  if (durationSec > 0) {
    try {
      let exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&duration=${Math.round(durationSec)}`;
      if (cleanArtist) exactUrl += `&artist_name=${encodeURIComponent(cleanArtist)}`;
      const exactRes = await fetch(exactUrl, {
        headers: { 'User-Agent': 'DeluxeSongsMusicApp/3.0' },
        signal: AbortSignal.timeout(3500),
      });
      if (exactRes.ok) {
        const item = await exactRes.json();
        if (item.syncedLyrics && !item.instrumental && !isDisallowedCandidate(item.trackName, item.artistName, cleanTrack)) {
          const parsed = parseLrc(item.syncedLyrics);
          if (parsed.length > 0) {
            return {
              synced: true,
              lines: parsed,
              plainLyrics: item.plainLyrics || undefined,
              source: 'lrclib',
            };
          }
        }
      }
    } catch {
      // Continue to search
    }
  }

  // 2. Search Queries with Strict 3-Point Scoring
  const queries = [
    `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTrack + (cleanArtist ? ' ' + cleanArtist : ''))}`,
    primaryArtist && primaryArtist !== cleanArtist
      ? `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTrack + ' ' + primaryArtist)}`
      : null,
    `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTrack)}`,
  ].filter(Boolean) as string[];

  for (const url of queries) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'DeluxeSongsMusicApp/3.0' },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          // Score and rank candidates by Song Name + Artist + Duration
          const scored = list
            .filter((item: any) => !item.instrumental)
            .map((item: any) => ({
              ...item,
              _score: computeMatchScore(item, cleanTrack, cleanArtist, durationSec),
            }))
            .filter((item: any) => item._score > 0)
            .sort((a: any, b: any) => b._score - a._score);

          // Priority 1: Top scored item with Synced Lyrics
          const withSynced = scored.find((item: any) => item.syncedLyrics && item.syncedLyrics.length > 10);
          if (withSynced) {
            const parsed = parseLrc(withSynced.syncedLyrics);
            if (parsed.length > 0) {
              return {
                synced: true,
                lines: parsed,
                plainLyrics: withSynced.plainLyrics || undefined,
                source: 'lrclib',
              };
            }
          }

          // Priority 2: Top scored item with Plain Lyrics
          const withPlain = scored.find((item: any) => item.plainLyrics && item.plainLyrics.trim().length > 15);
          if (withPlain) {
            return {
              synced: false,
              lines: [],
              plainLyrics: withPlain.plainLyrics,
              source: 'lrclib',
            };
          }
        }
      }
    } catch {
      // Continue
    }
  }
  return null;
}

// Provider 2: NetEase Cloud Music (Fallback Synced Database with 3-Point Scoring)
async function fetchNetEase(
  cleanTrack: string,
  cleanArtist: string,
  primaryArtist: string,
  durationSec: number
): Promise<LyricsData | null> {
  const searchTerms = [
    cleanTrack + (primaryArtist ? ' ' + primaryArtist : ''),
    cleanTrack,
  ];

  for (const s of searchTerms) {
    try {
      const params = new URLSearchParams({ s, type: '1', limit: '10' });
      const searchRes = await fetch('https://music.163.com/api/search/get', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://music.163.com',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(4500),
      });

      if (searchRes.ok) {
        const data = await searchRes.json();
        const songs = data?.result?.songs;
        if (Array.isArray(songs) && songs.length > 0) {
          const scored = songs
            .map((song: any) => ({
              ...song,
              _score: computeMatchScore(song, cleanTrack, cleanArtist, durationSec),
            }))
            .filter((song: any) => song._score > 0)
            .sort((a: any, b: any) => b._score - a._score);

          for (const song of scored.slice(0, 3)) {
            if (!song.id) continue;
            const lrcRes = await fetch(`https://music.163.com/api/song/lyric?os=pc&id=${song.id}&lv=-1&kv=-1&tv=-1`, {
              headers: { 'Referer': 'https://music.163.com' },
              signal: AbortSignal.timeout(3500),
            });

            if (lrcRes.ok) {
              const lrcData = await lrcRes.json();
              const lrcText = lrcData?.lrc?.lyric;
              if (lrcText && lrcText.length > 20) {
                const parsed = parseLrc(lrcText);
                if (parsed.length >= 4) {
                  return {
                    synced: true,
                    lines: parsed,
                    source: 'netease',
                  };
                }
              }
            }
          }
        }
      }
    } catch {
      // Continue
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get('track') || searchParams.get('name') || '';
  const artist = searchParams.get('artist') || '';
  const duration = parseFloat(searchParams.get('duration') || '0');
  const forceRefresh = searchParams.get('refresh') === 'true';

  return handleLyricsRequest(track, artist, duration, forceRefresh);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const track = body.track || body.name || '';
    const artist = body.artist || '';
    const duration = parseFloat(body.duration || '0');
    const forceRefresh = !!body.refresh;

    return handleLyricsRequest(track, artist, duration, forceRefresh);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleLyricsRequest(rawTrack: string, rawArtist: string, durationSec: number, forceRefresh = false) {
  const cleanTrack = cleanMetadataString(rawTrack);
  const cleanArtist = cleanMetadataString(rawArtist);
  const primaryArtist = getPrimaryArtist(cleanArtist);

  if (!cleanTrack) {
    return NextResponse.json({ error: 'Song track name is required' }, { status: 400 });
  }

  const cacheKey = `${cleanTrack.toLowerCase()}__${cleanArtist.toLowerCase()}`;
  const sanitizedFileName = cacheKey.replace(/[^a-z0-9]/gi, '_');
  const s3Key = `Music/Lyrics/${sanitizedFileName}.json`;

  let cachedFallback: LyricsData | null = null;

  // 1. Check Memory Cache (only if synced)
  if (!forceRefresh && lyricsMemoryCache.has(cacheKey)) {
    const cached = lyricsMemoryCache.get(cacheKey)!;
    if (cached.synced && cached.lines.length >= 4) {
      return NextResponse.json(cached);
    }
    cachedFallback = cached;
  }

  // 2. Check S3 Cache (only if synced)
  try {
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    const s3Response = await s3Client.send(getCommand);
    if (s3Response.Body) {
      const jsonStr = await s3Response.Body.transformToString();
      const cachedData: LyricsData = JSON.parse(jsonStr);
      if (cachedData.synced && cachedData.lines && cachedData.lines.length >= 4) {
        lyricsMemoryCache.set(cacheKey, cachedData);
        return NextResponse.json({ ...cachedData, source: 's3_cache' });
      }
      cachedFallback = cachedData;
    }
  } catch (e: any) {
    if (e.name !== 'NoSuchKey') {
      console.warn('S3 Lyrics Cache read error:', e.message);
    }
  }

  // 3. Multi-Source Pipeline: Query LRCLIB and NetEase
  let lyricsResult: LyricsData = {
    synced: false,
    lines: [],
    source: 'none',
  };

  // Try LRCLIB first
  const lrclibData = await fetchLrclib(cleanTrack, cleanArtist, primaryArtist, durationSec);
  if (lrclibData && lrclibData.synced && lrclibData.lines.length >= 4) {
    lyricsResult = lrclibData;
  } else {
    // Try NetEase as fallback
    const neteaseData = await fetchNetEase(cleanTrack, cleanArtist, primaryArtist, durationSec);
    if (neteaseData && neteaseData.synced && neteaseData.lines.length >= 4) {
      lyricsResult = neteaseData;
    } else if (lrclibData && lrclibData.plainLyrics) {
      lyricsResult = lrclibData;
    } else if (neteaseData && neteaseData.lines.length > 0) {
      lyricsResult = neteaseData;
    } else if (cachedFallback) {
      lyricsResult = cachedFallback;
    }
  }

  // 4. Save result to S3 Bucket
  if (lyricsResult.lines.length > 0 || lyricsResult.plainLyrics) {
    try {
      const putCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: JSON.stringify(lyricsResult, null, 2),
        ContentType: 'application/json',
      });
      await s3Client.send(putCommand);
    } catch (e: any) {
      console.error('Failed to write lyrics to S3 cache:', e.message);
    }
  }

  lyricsMemoryCache.set(cacheKey, lyricsResult);
  return NextResponse.json(lyricsResult);
}
