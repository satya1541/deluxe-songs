import { searchSaavnSongs, formatSaavnSong, getTrendingSaavnSongs, searchSaavnArtists, searchSaavnAlbums } from '@/lib/saavn-stream';
import { ExploreSong, AudioSourcePlatform, SourceBadge, CanonicalSong, CanonicalArtist, CanonicalAlbum, ExploreSearchResult } from '@/types/explore';
import { detectSearchIntent, isCanonicalMatch } from '@/lib/search-utils';
import play from 'play-dl';

// Cache for Innertube singleton
let innertubeInstance: any = null;

async function getInnertube() {
  if (!innertubeInstance) {
    try {
      // Dynamic import to support ESM package in Next.js
      const { Innertube } = await import('youtubei.js');
      const cookie = process.env.YOUTUBE_COOKIE || undefined;
      const po_token = process.env.YOUTUBE_PO_TOKEN || undefined;
      const visitor_data = process.env.YOUTUBE_VISITOR_DATA || undefined;

      if (cookie) {
        console.log('[YT INNERTUBE] Initializing with authenticated YOUTUBE_COOKIE');
      }

      innertubeInstance = await Innertube.create({
        cookie,
        po_token,
        visitor_data,
        // Pass cache: 'no-store' to bypass Next.js 2MB fetch cache limit on YouTube player JS
        fetch: ((input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' })) as any,
      });
    } catch (err) {
      console.log('Failed to initialize Innertube:', err);
    }
  }
  return innertubeInstance;
}

// SoundCloud client ID initialization
let soundCloudClientId: string | null = null;
let lastSoundCloudInit = 0;

async function initSoundCloud() {
  const now = Date.now();
  if (!soundCloudClientId || now - lastSoundCloudInit > 1000 * 60 * 60) {
    try {
      soundCloudClientId = await play.getFreeClientID();
      await play.setToken({ soundcloud: { client_id: soundCloudClientId } });
      lastSoundCloudInit = now;
    } catch (err) {
      console.warn('Could not refresh SoundCloud client ID:', err);
    }
  }
}

// Source Badges
export const SOURCE_BADGES: Record<AudioSourcePlatform, SourceBadge> = {
  jiosaavn: {
    name: 'Lossless',
    icon: '⚡',
    logoUrl: '/lossless-logo.jpeg',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.3)',
    qualityLabel: 'Lossless',
  },
  youtube: {
    name: 'Opus',
    icon: '🎵',
    logoUrl: '/opus-logo.jpeg',
    color: '#ff4e45',
    bg: 'rgba(255, 78, 69, 0.12)',
    border: 'rgba(255, 78, 69, 0.3)',
    qualityLabel: 'Opus',
  },
  soundcloud: {
    name: 'SoundCloud',
    icon: '🟠',
    color: '#ff7700',
    bg: 'rgba(255, 119, 0, 0.12)',
    border: 'rgba(255, 119, 0, 0.3)',
    qualityLabel: '128k HQ',
  },
};

/**
 * Upgrades any thumbnail URL (YouTube, JioSaavn, SoundCloud, Google CDN) to maximum 1080p/800x800 HD resolution.
 */
export function getUltraHdCoverArt(rawThumbUrl?: string, videoId?: string): string {
  const cleanId = (videoId || '').replace(/^yt_/, '').trim();

  // 1. If we have a Google CDN / YouTube Music thumbnail, upgrade it to 800x800 HD
  if (rawThumbUrl && (rawThumbUrl.includes('googleusercontent.com') || rawThumbUrl.includes('ggpht.com'))) {
    return rawThumbUrl
      .replace(/=w\d+-h\d+[^&]*/g, '=w800-h800-l90-rj')
      .replace(/=s\d+[^&]*/g, '=s800');
  }

  // 2. If it's a JioSaavn CDN thumbnail, upgrade to 500x500 HD
  if (rawThumbUrl && rawThumbUrl.includes('saavncdn.com')) {
    return rawThumbUrl
      .replace(/50x50\.jpg/gi, '500x500.jpg')
      .replace(/150x150\.jpg/gi, '500x500.jpg')
      .replace(/250x250\.jpg/gi, '500x500.jpg');
  }

  // 3. If it's a SoundCloud thumbnail, upgrade to 500x500
  if (rawThumbUrl && rawThumbUrl.includes('sndcdn.com')) {
    return rawThumbUrl.replace('-large.', '-t500x500.');
  }

  // 4. If we have raw ytimg URL or videoId
  if (rawThumbUrl && rawThumbUrl.includes('ytimg.com')) {
    // Keep hq720 or hqdefault which are guaranteed to exist, avoid forcing maxresdefault blindly
    return rawThumbUrl;
  }

  // 5. If only videoId is provided, use the reliable hqdefault.jpg / hq720.jpg
  if (cleanId && /^[a-zA-Z0-9_-]{11}$/.test(cleanId)) {
    return `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`;
  }

  if (rawThumbUrl) return rawThumbUrl;
  return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=90';
}

// 1. Search JioSaavn
export async function searchJioSaavn(query: string, limit = 15): Promise<ExploreSong[]> {
  try {
    const raw = await searchSaavnSongs(query, 1, limit);
    return raw.map((song) => ({
      ...song,
      source: 'jiosaavn',
      sourceBadge: SOURCE_BADGES.jiosaavn,
      quality: '320kbps',
    }));
  } catch (err) {
    console.error('JioSaavn search error:', err);
    return [];
  }
}

// 2. Search YouTube Music
export async function searchYouTubeMusic(query: string, limit = 12): Promise<ExploreSong[]> {
  try {
    const yt = await getInnertube();
    if (!yt) return [];

    const search = await yt.music.search(query, { type: 'song' });
    const rawSongs = search.contents?.[0]?.contents || search.songs?.contents || [];

    const songs: ExploreSong[] = [];
    for (const item of rawSongs.slice(0, limit)) {
      const id = item.id;
      if (!id) continue;

      const title = item.title || 'Unknown Title';
      const artist = item.artists?.map((a: any) => a.name).join(', ') || item.author?.name || 'Unknown Artist';
      const album = item.album?.name || 'YouTube Music';
      const durationSeconds = item.duration?.seconds || 0;

      // Extract highest resolution thumbnail
      const thumbs = item.thumbnails || [];
      const rawCover = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url;
      const cover = getUltraHdCoverArt(rawCover, id);

      songs.push({
        id: `yt_${id}`,
        name: title,
        artist,
        album,
        duration: durationSeconds,
        cover,
        streamUrl: `/api/explore/stream?source=youtube&id=${encodeURIComponent(id)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
        quality: '160kbps',
        source: 'youtube',
        sourceBadge: SOURCE_BADGES.youtube,
        hasLyrics: false,
      });
    }

    return songs;
  } catch (err) {
    console.error('YouTube Music search error:', err);
    return [];
  }
}

// 3. Search SoundCloud using SoundCloud v2 API for direct progressive MP3s
export async function searchSoundCloud(query: string, limit = 10): Promise<ExploreSong[]> {
  try {
    await initSoundCloud();
    if (!soundCloudClientId) return [];

    const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${soundCloudClientId}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const tracks = data.collection || [];

    const songs: ExploreSong[] = [];
    for (const t of tracks) {
      if (!t.title) continue;

      // Prefer progressive MP3 transcoding; fallback only if valid URL exists
      const transcodings = t.media?.transcodings || [];
      const progressive = transcodings.find((tc: any) => tc.format?.protocol === 'progressive')
        || transcodings.find((tc: any) => tc.url && !tc.url.includes('hls'))
        || transcodings[0];
      if (!progressive?.url) continue;

      const id = `sc_${t.id || Buffer.from(t.permalink_url || t.title).toString('base64').replace(/=/g, '')}`;
      const title = t.title || 'Untitled';
      const artist = t.user?.username || t.user?.name || 'SoundCloud Artist';
      const duration = Math.round((t.duration || 0) / 1000);
      const cover = t.artwork_url ? t.artwork_url.replace('-large', '-t500x500') : (t.user?.avatar_url || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80');

      songs.push({
        id,
        name: title,
        artist,
        album: 'SoundCloud',
        duration,
        cover,
        streamUrl: `/api/explore/stream?source=soundcloud&transcodeUrl=${encodeURIComponent(progressive.url)}`,
        quality: '128kbps',
        source: 'soundcloud',
        sourceBadge: SOURCE_BADGES.soundcloud,
        hasLyrics: false,
      });
    }

    return songs;
  } catch (err) {
    console.error('SoundCloud search error:', err);
    return [];
  }
}

// 4. Federated Multi-Source Search
export async function searchMultiSource(
  query: string,
  platform: 'all' | AudioSourcePlatform = 'all',
  limit = 30
): Promise<ExploreSearchResult> {
  const cleanQ = query.trim();
  if (!cleanQ) return { songs: [], artists: [], albums: [] };

  const intent = detectSearchIntent(cleanQ);

  // We fetch entities from JioSaavn if platform is all or jiosaavn.
  const [jioRes, ytRes, scRes, jioArtRes, jioAlbRes] = await Promise.allSettled([
    (platform === 'all' || platform === 'jiosaavn') ? searchJioSaavn(cleanQ, 20) : Promise.resolve([]),
    (platform === 'all' || platform === 'youtube') ? searchYouTubeMusic(cleanQ, 15) : Promise.resolve([]),
    (platform === 'all' || platform === 'soundcloud') ? searchSoundCloud(cleanQ, 10) : Promise.resolve([]),
    (platform === 'all' || platform === 'jiosaavn') ? searchSaavnArtists(cleanQ, 5) : Promise.resolve([]),
    (platform === 'all' || platform === 'jiosaavn') ? searchSaavnAlbums(cleanQ, 5) : Promise.resolve([]),
  ]);

  const jioSongs = jioRes.status === 'fulfilled' ? jioRes.value : [];
  const ytSongs = ytRes.status === 'fulfilled' ? ytRes.value : [];
  const scSongs = scRes.status === 'fulfilled' ? scRes.value : [];
  
  const artists: CanonicalArtist[] = jioArtRes.status === 'fulfilled' ? (jioArtRes.value as CanonicalArtist[]) : [];
  const albums: CanonicalAlbum[] = jioAlbRes.status === 'fulfilled' ? (jioAlbRes.value as CanonicalAlbum[]) : [];

  // Deduplication & Canonicalization of Songs
  const allRawSongs = [...jioSongs, ...ytSongs, ...scSongs];
  const canonicalSongs: CanonicalSong[] = [];

  for (const raw of allRawSongs) {
    // See if it matches an existing canonical song
    const existingIdx = canonicalSongs.findIndex(c => isCanonicalMatch(c.name, raw.name, c.duration, raw.duration));
    
    if (existingIdx !== -1) {
      // Merge as a fallback source
      if (!canonicalSongs[existingIdx].fallbackSources) {
        canonicalSongs[existingIdx].fallbackSources = [];
      }
      
      if (raw.source) {
        canonicalSongs[existingIdx].fallbackSources!.push({
          source: raw.source,
          id: raw.id,
          streamUrl: raw.streamUrl,
          quality: raw.quality,
          sourceBadge: raw.sourceBadge,
        });
      }
    } else {
      // Create new canonical song
      canonicalSongs.push({
        ...raw,
        type: 'song',
        fallbackSources: raw.source ? [{
          source: raw.source,
          id: raw.id,
          streamUrl: raw.streamUrl,
          quality: raw.quality,
          sourceBadge: raw.sourceBadge,
        }] : [],
      });
    }
  }

  // Determine top result
  let topResult: CanonicalArtist | CanonicalAlbum | CanonicalSong | undefined = undefined;
  
  if (intent.primary === 'artist' && artists.length > 0) {
    topResult = artists[0];
  } else if (intent.primary === 'album' && albums.length > 0) {
    topResult = albums[0];
  } else if (intent.primary === 'song' && canonicalSongs.length > 0) {
    topResult = canonicalSongs[0];
  } else {
    // General fallback: if artist name exactly matches query, show artist.
    const exactArtist = artists.find(a => a.name.toLowerCase() === cleanQ.toLowerCase());
    if (exactArtist) {
      topResult = exactArtist;
    } else if (canonicalSongs.length > 0) {
      topResult = canonicalSongs[0];
    }
  }

  // Remove topResult from the main lists if it's there
  let finalSongs = canonicalSongs;
  let finalArtists = artists;
  let finalAlbums = albums;

  if (topResult) {
    if (topResult.type === 'song') finalSongs = finalSongs.filter(s => s.id !== topResult!.id);
    if (topResult.type === 'artist') finalArtists = finalArtists.filter(a => a.id !== topResult!.id);
    if (topResult.type === 'album') finalAlbums = finalAlbums.filter(a => a.id !== topResult!.id);
  }

  return {
    topResult,
    songs: finalSongs.slice(0, limit),
    artists: finalArtists,
    albums: finalAlbums,
    intent,
  };
}

// In-memory cache for resolved YouTube stream URLs (persists for 3 hours across range requests)
const ytStreamUrlCache = new Map<string, { url: string; expiresAt: number }>();

// 5. Resolve Live Stream URL for YouTube (Unthrottled VISIONOS & ANDROID_VR formats)
export async function resolveYouTubeStreamUrl(videoId: string): Promise<string | null> {
  try {
    if (!videoId) return null;

    // Clean videoId: strip any 'yt_' prefix or URL parameters
    let cleanId = videoId.trim();
    if (cleanId.startsWith('yt_')) cleanId = cleanId.slice(3);
    if (cleanId.includes('v=')) cleanId = cleanId.split('v=')[1]?.split('&')[0] || cleanId;
    if (cleanId.includes('youtu.be/')) cleanId = cleanId.split('youtu.be/')[1]?.split('?')[0] || cleanId;

    // Check memory cache first - CRUCIAL for mobile Safari / AVPlayer which sends multiple range probes
    const cached = ytStreamUrlCache.get(cleanId);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`[YT STREAM] Cache HIT for videoId=${cleanId}`);
      return cached.url;
    }

    console.log(`[YT STREAM] Resolving fresh stream for videoId=${cleanId}...`);

    const yt = await getInnertube();
    if (!yt) {
      console.log(`[YT STREAM ERROR] Failed to initialize Innertube`);
      return null;
    }

    // Shifted to VISIONOS specifically to bypass 403 Forbidden errors
    const clientsToTry = ['VISIONOS', 'IOS', 'ANDROID_VR', 'ANDROID'];

    for (const clientName of clientsToTry) {
      try {
        console.log(`[YT STREAM] Querying YouTube via ${clientName} for videoId=${cleanId}...`);
        const res = await yt.actions.execute('/player', {
          videoId: cleanId,
          client: clientName,
        });

        const status = res.data?.playabilityStatus?.status;
        const reason = res.data?.playabilityStatus?.reason;
        if (status && status !== 'OK') {
          console.log(`[YT STREAM] ${clientName} playability: ${status} (${reason || 'no reason'})`);
          continue;
        }

        const formats = (res.data?.streamingData?.formats || []).concat(res.data?.streamingData?.adaptiveFormats || []);
        
        // 1. Check for highest-quality Opus audio (itag 251 - ~160kbps WebM)
        const itag251 = formats.find((f: any) => f.itag === 251 && f.url);
        if (itag251?.url) {
          console.log(`[YT STREAM SUCCESS] Resolved itag 251 Opus (160kbps WebM) via ${clientName} for videoId=${cleanId}`);
          ytStreamUrlCache.set(cleanId, {
            url: itag251.url,
            expiresAt: Date.now() + 3 * 60 * 60 * 1000,
          });
          return itag251.url;
        }

        // 2. Check for instant zero-buffer AAC audio (itag 140 - 128kbps MP4)
        const itag140 = formats.find((f: any) => f.itag === 140 && f.url);
        if (itag140?.url) {
          console.log(`[YT STREAM SUCCESS] Resolved itag 140 AAC (128kbps MP4) via ${clientName} for videoId=${cleanId}`);
          ytStreamUrlCache.set(cleanId, {
            url: itag140.url,
            expiresAt: Date.now() + 3 * 60 * 60 * 1000,
          });
          return itag140.url;
        }

        // 3. Fallback: any direct audio format with highest bitrate (sorted descending)
        const anyAudio = formats.filter((f: any) => f.mimeType?.includes('audio/') && f.url);
        if (anyAudio.length > 0) {
          anyAudio.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
          const chosen = anyAudio[0];
          console.log(`[YT STREAM SUCCESS] Resolved audio (itag ${chosen.itag}) via ${clientName} for videoId=${cleanId}`);
          ytStreamUrlCache.set(cleanId, {
            url: chosen.url,
            expiresAt: Date.now() + 3 * 60 * 60 * 1000,
          });
          return chosen.url;
        }

        // 4. Universal progressive MP4 (itag 18)
        const itag18 = formats.find((f: any) => f.itag === 18 && f.url);
        if (itag18?.url) {
          console.log(`[YT STREAM SUCCESS] Resolved itag 18 progressive MP4 via ${clientName} for videoId=${cleanId}`);
          ytStreamUrlCache.set(cleanId, {
            url: itag18.url,
            expiresAt: Date.now() + 3 * 60 * 60 * 1000,
          });
          return itag18.url;
        }
      } catch (clientErr: any) {
        console.log(`[YT STREAM] ${clientName} error: ${clientErr?.message || clientErr}`);
      }
    }

    console.log(`[YT STREAM ERROR] All clients exhausted with no direct URLs for videoId=${cleanId}`);
    return null;
  } catch (err: any) {
    console.log(`[YT STREAM EXCEPTION] Failed for ${videoId}:`, err?.message || err);
    return null;
  }
}

// 6. Resolve Live Stream URL for SoundCloud (Direct Progressive MP3)
export async function resolveSoundCloudStreamUrl(transcodeOrTrackUrl: string): Promise<string | null> {
  try {
    await initSoundCloud();
    if (!soundCloudClientId) return null;

    // If it's a transcode URL from SoundCloud API v2
    if (transcodeOrTrackUrl.includes('/stream/progressive') || transcodeOrTrackUrl.includes('/stream/hls') || transcodeOrTrackUrl.includes('api-v2.soundcloud.com/media')) {
      const sep = transcodeOrTrackUrl.includes('?') ? '&' : '?';
      const target = `${transcodeOrTrackUrl}${sep}client_id=${soundCloudClientId}`;
      const res = await fetch(target);
      if (!res.ok) {
        // Refresh client ID once on error
        soundCloudClientId = await play.getFreeClientID();
        const retryTarget = `${transcodeOrTrackUrl}${sep}client_id=${soundCloudClientId}`;
        const retryRes = await fetch(retryTarget);
        if (!retryRes.ok) return null;
        const retryData = await retryRes.json();
        return retryData.url || null;
      }
      const data = await res.json();
      return data.url || null;
    }

    // Fallback if full track URL was passed
    const stream = await play.stream(transcodeOrTrackUrl);
    return (stream as any)?.url || null;
  } catch (err) {
    console.error('Failed to resolve SoundCloud stream URL:', err);
    return null;
  }
}

const YOUTUBE_OFFICIAL_CHARTS: Record<string, string> = {
  'all': 'PL4fGSI1pDJn5oibdgJt8Hy0-dr2B7kSs2', // Daily Top Music Videos - India
  'hindi': 'PL4fGSI1pDJn5RgLW0Sb_zECecWdH_4zOX', // Top Weekly Videos Hindi
  'punjabi': 'PL4fGSI1pDJn5JXkyIohg2RstsbL2SnRew', // Top Weekly Videos Punjabi
  'tamil': 'PL4fGSI1pDJn4WX22qg1Po7qKOwOb4H6Sk', // Top Weekly Videos Tamil
  'telugu': 'PL4fGSI1pDJn5ALuqpEj_YZ8mEyw9WN8jd', // Top Weekly Videos Telugu
  'haryanvi': 'PL4fGSI1pDJn4tiNLMZVGGt2Kghgw__2u0', // Top Weekly Videos Haryanvi
};

// Fetches YouTube Music's authentic, current trending playlist for each language
export async function getTrendingYouTubeMusic(language = 'hindi', limit = 30): Promise<ExploreSong[]> {
  try {
    const langKey = language.toLowerCase();
    const chartPlaylistId = YOUTUBE_OFFICIAL_CHARTS[langKey];

    if (chartPlaylistId) {
      const yt = await getInnertube();
      if (!yt) return [];

      try {
        const pl = await yt.music.getPlaylist(chartPlaylistId);
        const items = (pl.items || []).slice(0, limit);
        
        const songs: ExploreSong[] = [];
        for (const item of items) {
          const id = item.id;
          if (!id) continue;
          const title = item.title?.text || item.title || 'Unknown Title';
          const artist = (item.authors || item.artists)?.map((a: any) => a.name).join(', ') || item.author?.name || 'YouTube Music';
          const album = item.album?.name || `${language} Charts`;
          const duration = item.duration?.seconds || 0;
          
          const thumbs = item.thumbnails || [];
          const rawCover = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url;
          const cover = getUltraHdCoverArt(rawCover, id);

          songs.push({
            id: `yt_${id}`,
            name: title,
            artist,
            album,
            duration,
            cover,
            streamUrl: `/api/explore/stream?source=youtube&id=${encodeURIComponent(id)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
            quality: '160kbps',
            source: 'youtube',
            sourceBadge: SOURCE_BADGES.youtube,
            hasLyrics: false,
          });
        }
        if (songs.length > 0) return songs;
      } catch (err) {
        console.warn(`Could not load direct YouTube chart ${chartPlaylistId}:`, err);
      }
    }

    // Fallback: If no official YT chart exists for the language (e.g. Marathi, Bengali),
    // or if fetching it failed, we fetch the true authentic chart from JioSaavn,
    // and resolve the streams via YouTube on-demand to preserve accurate metadata.
    const rawSaavn = await getTrendingSaavnSongs(language);
    const chartSongs = rawSaavn.slice(0, limit);
    
    return chartSongs.map((s) => ({
      ...s,
      source: 'youtube',
      sourceBadge: SOURCE_BADGES.youtube,
      quality: '160kbps',
      streamUrl: `/api/explore/stream?source=youtube&title=${encodeURIComponent(s.name)}&artist=${encodeURIComponent(s.artist)}`,
    }));

  } catch (err) {
    console.error('Error fetching YouTube language trending:', err);
    return [];
  }
}

// 7. Federated Trending / Browse songs across all 3 platforms
export async function getTrendingMultiSource(
  language = 'all',
  platform: 'all' | AudioSourcePlatform = 'all',
  limit = 30
): Promise<ExploreSong[]> {
  const langKey = language.toLowerCase();
  const searchLang = langKey === 'all' ? 'Top Hits' : `${language} Hits`;

  if (platform === 'jiosaavn') {
    const raw = await getTrendingSaavnSongs(language);
    return raw.slice(0, limit).map((s) => ({
      ...s,
      source: 'jiosaavn' as AudioSourcePlatform,
      sourceBadge: SOURCE_BADGES.jiosaavn,
      quality: '320kbps',
    }));
  }

  if (platform === 'youtube') {
    // Return YouTube Music's own authentic current trending songs for this language
    return getTrendingYouTubeMusic(language, limit);
  }

  if (platform === 'soundcloud') {
    // Fetch official chart from JioSaavn, map to SoundCloud tracks on-demand
    const raw = await getTrendingSaavnSongs(language);
    const chartSongs = raw.slice(0, limit);
    
    if (chartSongs.length > 0) {
      return chartSongs.map((s) => ({
        ...s,
        source: 'soundcloud',
        sourceBadge: SOURCE_BADGES.soundcloud,
        quality: '128kbps',
        // Our stream endpoint doesn't currently support on-demand SC search by title/artist like YT does,
        // but it will fallback to JioSaavn stream or fail gracefully if we don't pass a valid ID.
        // Actually, we can just let it fallback to JioSaavn if SC stream is missing, 
        // which gives them the correct song anyway!
        streamUrl: `/api/explore/stream?source=soundcloud&title=${encodeURIComponent(s.name)}&artist=${encodeURIComponent(s.artist)}`,
      }));
    }
    
    return searchSoundCloud(`${searchLang} Songs`, limit);
  }

  // STRICT CHART LOGIC vs BROAD EXPLORE LOGIC
  // Based on architectural review rules:
  // - JioSaavn = Official regional/editorial charts.
  // - YouTube Data API = Global/India-wide national trends (not local language).
  // - SoundCloud = Kept separate for indie/remix supplementary discovery.
  
  if (langKey !== 'all') {
    // For regional languages (Hindi, Punjabi, Odia, etc.), we enforce STRICT CHART LOGIC.
    // We only use JioSaavn because it provides highly accurate, editorial regional charts.
    // Zippering YouTube search results for "Odia hits" pollutes the chart with unstructured content.
    const raw = await getTrendingSaavnSongs(language);
    return raw.slice(0, limit).map((s) => ({
      ...s,
      source: 'jiosaavn' as AudioSourcePlatform,
      sourceBadge: SOURCE_BADGES.jiosaavn,
      quality: '320kbps',
    }));
  }

  // For 'all' / global, we use BROAD EXPLORE LOGIC.
  // We use JioSaavn's national top charts, but we map half of them to YouTube Music to create a diverse platform blend 
  // without losing the authenticity of official charts.
  // We explicitly EXCLUDE SoundCloud from charts to prevent amateur remixes from polluting official hits.
  const jioRes = await getTrendingSaavnSongs('all');
  
  // Take top 20 official charts
  const top20 = jioRes.slice(0, 20);
  
  // Map odds to YouTube, evens to JioSaavn
  const blendPromises = top20.map(async (song, i) => {
    if (i % 2 !== 0) {
      // Map to YouTube Music
      return {
        ...song,
        source: 'youtube',
        sourceBadge: SOURCE_BADGES.youtube,
        quality: '160kbps',
        streamUrl: `/api/explore/stream?source=youtube&title=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist)}`,
      };
    }
    // Keep as JioSaavn
    return {
      ...song,
      source: 'jiosaavn' as AudioSourcePlatform,
      sourceBadge: SOURCE_BADGES.jiosaavn,
      quality: '320kbps',
    };
  });
  
  const combined = (await Promise.all(blendPromises)).filter(Boolean) as ExploreSong[];

  return combined.slice(0, limit);
}

