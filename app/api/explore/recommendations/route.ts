import { NextRequest, NextResponse } from 'next/server';
import {
  searchJioSaavn,
  searchYouTubeMusic,
  searchSoundCloud,
  searchMultiSource,
  SOURCE_BADGES,
} from '@/lib/multi-music';
import { getInstantEmotion } from '@/lib/emotions';
import { ExploreSong, AudioSourcePlatform } from '@/types/explore';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME } from '@/lib/s3';

// In-memory cache for ultra-fast <5ms lookups
const recommendationCache = new Map<string, { songs: ExploreSong[]; emotion: any }>();

export const dynamic = 'force-dynamic';

const PLATFORMS: AudioSourcePlatform[] = ['jiosaavn', 'youtube', 'soundcloud'];

// Normalize song title to prevent duplicate tracks and compilation repacks
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Compute deterministic cache key with version prefix
function getCacheKey(name: string, artist: string, language: string, useAi: boolean): string {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40);
  const cleanArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  const cleanLang = (language || 'all').toLowerCase();
  const mode = useAi ? 'ai' : 'fast';
  return `v6_interleaved_${mode}_${cleanName}_${cleanArtist}_${cleanLang}`;
}

// Read recommendations from AWS S3 cache
async function getCachedFromS3(cacheKey: string) {
  try {
    const s3Key = `Recommendations/${cacheKey}.json`;
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    const s3Response = await s3Client.send(getCommand);
    if (s3Response.Body) {
      const bodyString = await s3Response.Body.transformToString();
      const parsed = JSON.parse(bodyString);
      if (Array.isArray(parsed?.songs) && parsed.songs.length > 0) {
        return parsed;
      }
    }
  } catch {
    // S3 cache miss - proceed to live generation
  }
  return null;
}

// Save recommendations to AWS S3 cache
async function saveToS3(cacheKey: string, data: any) {
  try {
    const s3Key = `Recommendations/${cacheKey}.json`;
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    });
    await s3Client.send(putCommand);
  } catch (err) {
    console.error('Failed to cache recommendations to S3:', err);
  }
}

// Helper to query a specific music platform
async function searchTrackOnPlatform(
  query: string,
  platform: AudioSourcePlatform,
  limit = 3
): Promise<ExploreSong[]> {
  try {
    if (platform === 'jiosaavn') {
      return await searchJioSaavn(query, limit);
    }
    if (platform === 'youtube') {
      return await searchYouTubeMusic(query, limit);
    }
    if (platform === 'soundcloud') {
      return await searchSoundCloud(query, limit);
    }
  } catch (err) {
    console.warn(`Search failed on ${platform} for "${query}":`, err);
  }
  return [];
}

// Interleaved resolver for Gemini AI DJ items
async function resolveCuratedTrackInterleaved(
  item: { title: string; artist: string },
  preferredPlatform: AudioSourcePlatform
): Promise<ExploreSong | null> {
  const query = `${item.title} ${item.artist}`.trim();
  const targetTitleNorm = normalizeTitle(item.title);

  // 1. Try preferred interleaved platform first
  try {
    const hits = await searchTrackOnPlatform(query, preferredPlatform, 3);
    if (hits && hits.length > 0) {
      const match =
        hits.find((h) => {
          const hNorm = normalizeTitle(h.name);
          const hLower = h.name.toLowerCase();
          if (
            hLower.includes('mashup') ||
            hLower.includes('non-stop') ||
            hLower.includes('dj remix')
          ) {
            return false;
          }
          return hNorm.includes(targetTitleNorm) || targetTitleNorm.includes(hNorm);
        }) || hits[0];

      if (match) return match;
    }
  } catch (err) {
    console.warn(`Error resolving "${query}" on preferred platform ${preferredPlatform}:`, err);
  }

  // 2. Fallback to the other platforms in order if not available on preferred
  const alternatePlatforms = PLATFORMS.filter((p) => p !== preferredPlatform);
  for (const alt of alternatePlatforms) {
    try {
      const altHits = await searchTrackOnPlatform(query, alt, 3);
      if (altHits && altHits.length > 0) {
        const altMatch =
          altHits.find((h) => {
            const hNorm = normalizeTitle(h.name);
            const hLower = h.name.toLowerCase();
            if (hLower.includes('mashup') || hLower.includes('non-stop')) return false;
            return hNorm.includes(targetTitleNorm) || targetTitleNorm.includes(hNorm);
          }) || altHits[0];

        if (altMatch) return altMatch;
      }
    } catch {}
  }

  return null;
}

// Robust parser for Gemini JSON outputs with sanitization and regex fallback
function extractAndParseJsonArray(rawText: string): Array<{ title: string; artist: string }> {
  if (!rawText) return [];

  let text = rawText.trim();
  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Find array bounds [ ... ]
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    text = text.substring(firstBracket, lastBracket + 1);
  }

  // Remove trailing commas before } or ] and strip comments
  const sanitized = text
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  try {
    const parsed = JSON.parse(sanitized);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: any) => ({
          title: String(item?.title || item?.name || '').trim(),
          artist: String(item?.artist || '').trim(),
        }))
        .filter((item) => item.title.length > 0);
    }
  } catch {
    // Regex fallback if JSON contains syntax anomalies
    const matches = Array.from(
      sanitized.matchAll(/\{[\s\S]*?"title"\s*:\s*"([^"]+)"[\s\S]*?"artist"\s*:\s*"([^"]+)"[\s\S]*?\}/g)
    );
    const results: Array<{ title: string; artist: string }> = [];
    for (const m of matches) {
      if (m[1]) {
        results.push({
          title: m[1].trim(),
          artist: (m[2] || '').trim(),
        });
      }
    }
    if (results.length > 0) {
      return results;
    }
  }
  return [];
}

// Curate radio tracklist using Google Gemini AI DJ
async function curateWithGemini(
  songName: string,
  songArtist: string,
  language: string
): Promise<Array<{ title: string; artist: string }> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are an expert music curator for an audiophile streaming service.
The user is currently listening to:
- Title: "${songName}"
- Artist: "${songArtist}"
- Language: ${language}

Your task is to curate an authentic, highly cohesive 12-track "Up Next" queue following this EXACT 2-part structure:

PART 1: THE SAME ARTIST (Tracks 1, 2, and 3):
- You MUST select 2 to 3 of the absolute BEST, most iconic songs by "${songArtist}" (or primary composer/singer) that match the EXACT same emotional mood, tempo, vocal intensity, and sonic texture as "${songName}".
- DO NOT include "${songName}" itself or any remixes/alternate versions of it.

PART 2: PEER ARTISTS IN THE EXACT SAME MOOD (Tracks 4 to 12):
- Transition into iconic songs by closely related peer artists that share the exact same sonic signature, emotional depth, and genre.
- Keep the mood strictly identical (e.g. if it is a melancholic rock ballad with electric guitar and heartbreak lyrics, every song must be a melancholic rock/heartbreak ballad; NEVER include upbeat dance, pop party, or mismatched tempos).

CRITICAL CONSTRAINTS:
1. Every song must be an authentic, well-known, commercially released song title with its primary singer.
2. Absolutely NO mashups, non-stop medleys, or DJ remixes.
3. Return ONLY a valid JSON array of objects: [{"title": "Exact Title", "artist": "Artist/Singer"}]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  artist: { type: 'STRING' },
                },
                required: ['title', 'artist'],
              },
            },
          },
        }),
      }
    );

    if (!res.ok) {
      console.warn('Gemini API returned error:', res.status, res.statusText);
      return null;
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: any) => p.text && !p.thought) || parts[parts.length - 1];
    const text = textPart?.text || '';
    const curated = extractAndParseJsonArray(text);

    if (curated.length > 0) {
      return curated;
    }
  } catch (err) {
    console.error('Error in Gemini AI DJ curation:', err);
  }
  return null;
}

// Fallback search queries if AI is unreachable
function buildFallbackQueries(
  emotionType: string,
  primaryArtist: string,
  language: string
): string[] {
  const lang = language && language !== 'all' ? language : 'Hindi';
  const cleanArtist = primaryArtist.replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  const queries: string[] = [];

  if (cleanArtist) {
    if (emotionType.includes('sad') || emotionType.includes('heartbreak')) {
      queries.push(`${cleanArtist} Sad`);
    } else if (emotionType.includes('happy') || emotionType.includes('party')) {
      queries.push(`${cleanArtist} Dance`);
    } else if (emotionType.includes('sufi') || emotionType.includes('devotional')) {
      queries.push(`${cleanArtist} Sufi`);
    } else {
      queries.push(`${cleanArtist} Romantic`);
    }
    queries.push(cleanArtist);
  }

  switch (emotionType) {
    case 'sad_romantic':
    case 'heartbroken_romantic':
    case 'heartbroken':
      queries.push(`${lang} Sad Songs`);
      queries.push(`${lang} Heartbreak Hits`);
      break;
    case 'yearning_romantic':
      queries.push(`${lang} Soulful Viraha Songs`);
      break;
    case 'dark_romantic':
      queries.push(`${lang} Dark Romance`);
      break;
    case 'happy_romantic':
      queries.push(`${lang} Romantic Dance Hits`);
      break;
    case 'devotional_romantic':
      queries.push(`${lang} Sufi Hits`);
      break;
    default:
      queries.push(`${lang} Romantic Hits`);
      break;
  }

  return queries;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || '';
  const artist = searchParams.get('artist') || '';
  const language = searchParams.get('language') || 'all';
  const excludeId = searchParams.get('songId') || '';
  const useAi = searchParams.get('useAi') === 'true';

  if (!name && !artist) {
    return NextResponse.json(
      { success: false, message: 'Song name or artist required' },
      { status: 400 }
    );
  }

  const cacheKey = getCacheKey(name, artist, language, useAi);

  // 1. Check in-memory cache
  if (recommendationCache.has(cacheKey)) {
    const cached = recommendationCache.get(cacheKey)!;
    return NextResponse.json({
      success: true,
      source: 'memory-cache',
      emotion: cached.emotion,
      songs: cached.songs,
    });
  }

  // 2. Check S3 persistent cache
  const s3Cached = await getCachedFromS3(cacheKey);
  if (s3Cached) {
    recommendationCache.set(cacheKey, s3Cached);
    return NextResponse.json({
      success: true,
      source: 's3-cache',
      emotion: s3Cached.emotion,
      songs: s3Cached.songs,
    });
  }

  try {
    // 3. Compute dominant emotion
    const emotionData = getInstantEmotion(name, artist);
    const emotionType = emotionData.emotion || 'soft_romantic';
    const emotionPayload = {
      type: emotionType,
      label: emotionData.label,
      icon: emotionData.icon,
      color: emotionData.color,
      secondary: emotionData.secondary,
    };

    const seenNormalizedTitles = new Set<string>();
    seenNormalizedTitles.add(normalizeTitle(name));

    const seenIds = new Set<string>();
    if (excludeId) seenIds.add(excludeId);

    const allSongs: ExploreSong[] = [];

    // 4. Try Gemini AI DJ Curation ONLY if user enabled AI recommendations (saves tokens & latency by default)
    let aiCurated: Array<{ title: string; artist: string }> | null = null;
    if (useAi) {
      aiCurated = await curateWithGemini(name, artist, language);
    }

    if (Array.isArray(aiCurated) && aiCurated.length >= 5) {
      // Interleaved resolution across JioSaavn, YouTube Music, and SoundCloud
      const resolved = await Promise.all(
        aiCurated.map((item, idx) => {
          const preferredPlatform = PLATFORMS[idx % PLATFORMS.length];
          return resolveCuratedTrackInterleaved(item, preferredPlatform);
        })
      );

      for (const song of resolved) {
        if (!song) continue;
        if (seenIds.has(song.id)) continue;

        const norm = normalizeTitle(song.name);
        if (seenNormalizedTitles.has(norm)) continue;

        // Skip non-stop mashups
        if (
          song.name.toLowerCase().includes('mashup') ||
          song.name.toLowerCase().includes('non-stop')
        ) {
          continue;
        }

        seenIds.add(song.id);
        seenNormalizedTitles.add(norm);
        allSongs.push(song);
      }
    }

    // 5. Fallback multi-source replenishment if AI is offline or returned fewer than 8 songs
    if (allSongs.length < 10) {
      const primaryArtist = artist ? artist.split(/[,/&]/)[0].trim() : '';

      // First ensure 2-3 songs by the same artist across platforms
      if (primaryArtist) {
        const artistSongs = await searchMultiSource(`${primaryArtist} ${name}`, 'all', 6);
        for (const song of artistSongs) {
          if (allSongs.length >= 4) break;
          if (seenIds.has(song.id)) continue;
          const norm = normalizeTitle(song.name);
          if (seenNormalizedTitles.has(norm)) continue;
          seenIds.add(song.id);
          seenNormalizedTitles.add(norm);
          allSongs.push(song);
        }
      }

      const fallbackQueries = buildFallbackQueries(emotionType, primaryArtist, language);
      for (const query of fallbackQueries) {
        if (allSongs.length >= 20) break;
        const res = await searchMultiSource(query, 'all', 12);
        for (const song of res) {
          if (allSongs.length >= 20) break;
          if (seenIds.has(song.id)) continue;

          const norm = normalizeTitle(song.name);
          if (seenNormalizedTitles.has(norm)) continue;

          seenIds.add(song.id);
          seenNormalizedTitles.add(norm);
          allSongs.push(song);
        }
      }
    }

    // Ensure all songs have proper platform badges
    const finalSongs: ExploreSong[] = allSongs.slice(0, 20).map((s) => {
      const src = (s.source || 'jiosaavn') as AudioSourcePlatform;
      return {
        ...s,
        source: src,
        sourceBadge: s.sourceBadge || SOURCE_BADGES[src],
      };
    });

    const result = {
      emotion: emotionPayload,
      songs: finalSongs,
    };

    // Save to in-memory & S3 caches
    recommendationCache.set(cacheKey, result);
    saveToS3(cacheKey, result).catch(() => {});

    return NextResponse.json({
      success: true,
      source: aiCurated ? 'gemini-ai-dj-interleaved' : 'fallback-multi-source',
      ...result,
    });
  } catch (err: any) {
    console.error('Error in recommendations route:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch recommendations', songs: [] },
      { status: 500 }
    );
  }
}
