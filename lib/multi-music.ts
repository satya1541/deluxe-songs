import { searchSaavnSongs, formatSaavnSong, getTrendingSaavnSongs } from '@/lib/saavn-stream';
import { ExploreSong, AudioSourcePlatform, SourceBadge } from '@/types/explore';
import play from 'play-dl';

// Cache for Innertube singleton
let innertubeInstance: any = null;

async function getInnertube() {
  if (!innertubeInstance) {
    try {
      // Dynamic import to support ESM package in Next.js
      const { Innertube } = await import('youtubei.js');
      innertubeInstance = await Innertube.create({
        // Pass cache: 'no-store' to bypass Next.js 2MB fetch cache limit on YouTube player JS
        fetch: ((input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' })) as any,
      });
    } catch (err) {
      console.error('Failed to initialize Innertube:', err);
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
    name: 'JioSaavn',
    icon: '🟢',
    color: '#1ed760',
    bg: 'rgba(30, 215, 96, 0.12)',
    border: 'rgba(30, 215, 96, 0.3)',
    qualityLabel: '320k Master',
  },
  youtube: {
    name: 'YouTube Music',
    icon: '🔴',
    color: '#ff4e45',
    bg: 'rgba(255, 78, 69, 0.12)',
    border: 'rgba(255, 78, 69, 0.3)',
    qualityLabel: '160k Opus',
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
      const cover = thumbs[thumbs.length - 1]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';

      songs.push({
        id: `yt_${id}`,
        name: title,
        artist,
        album,
        duration: durationSeconds,
        cover,
        streamUrl: `/api/explore/stream?source=youtube&id=${encodeURIComponent(id)}`,
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
): Promise<ExploreSong[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  if (platform === 'jiosaavn') {
    return searchJioSaavn(cleanQ, limit);
  }
  if (platform === 'youtube') {
    return searchYouTubeMusic(cleanQ, limit);
  }
  if (platform === 'soundcloud') {
    return searchSoundCloud(cleanQ, limit);
  }

  // Execute all 3 in parallel
  const [jioRes, ytRes, scRes] = await Promise.allSettled([
    searchJioSaavn(cleanQ, 15),
    searchYouTubeMusic(cleanQ, 10),
    searchSoundCloud(cleanQ, 8),
  ]);

  const jioSongs = jioRes.status === 'fulfilled' ? jioRes.value : [];
  const ytSongs = ytRes.status === 'fulfilled' ? ytRes.value : [];
  const scSongs = scRes.status === 'fulfilled' ? scRes.value : [];

  // Interleave results to provide rich variety
  const combined: ExploreSong[] = [];
  const maxLen = Math.max(jioSongs.length, ytSongs.length, scSongs.length);

  for (let i = 0; i < maxLen; i++) {
    if (jioSongs[i]) combined.push(jioSongs[i]);
    if (ytSongs[i]) combined.push(ytSongs[i]);
    if (scSongs[i]) combined.push(scSongs[i]);
  }

  return combined.slice(0, limit);
}

// 5. Resolve Live Stream URL for YouTube (Unthrottled VISIONOS & ANDROID_VR formats)
export async function resolveYouTubeStreamUrl(videoId: string): Promise<string | null> {
  try {
    const yt = await getInnertube();
    if (!yt) return null;

    // Use VISIONOS client - provides high-bitrate unthrottled audio (167k Opus / 131k AAC) without SABR/403 blocks
    const res = await yt.actions.execute('/player', {
      videoId,
      client: 'VISIONOS',
    });

    let formats = res.data?.streamingData?.adaptiveFormats || res.data?.streamingData?.formats || [];
    let audioFormats = formats.filter((f: any) => f.mimeType?.includes('audio/') && f.url);

    // Fallback to ANDROID_VR if VISIONOS has no direct URLs for this video
    if (audioFormats.length === 0) {
      const fallbackRes = await yt.actions.execute('/player', {
        videoId,
        client: 'ANDROID_VR',
      });
      formats = fallbackRes.data?.streamingData?.adaptiveFormats || [];
      audioFormats = formats.filter((f: any) => f.mimeType?.includes('audio/') && f.url);
    }

    if (audioFormats.length === 0) return null;

    // Prefer audio/mp4 (AAC-LC) because iOS Safari (all iPhones & iPads) cannot play audio/webm (Opus).
    // audio/mp4 provides universal playback across 100% of iOS, Android, and Desktop browsers.
    const mp4Formats = audioFormats.filter((f: any) => f.mimeType?.includes('audio/mp4'));
    const webmFormats = audioFormats.filter((f: any) => f.mimeType?.includes('audio/webm'));

    mp4Formats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
    webmFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

    const chosenFormat = mp4Formats[0] || webmFormats[0] || audioFormats[0];
    return chosenFormat?.url || null;
  } catch (err) {
    console.error('Failed to resolve YouTube stream URL:', err);
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
    return searchYouTubeMusic(`${searchLang} Songs`, limit);
  }

  if (platform === 'soundcloud') {
    return searchSoundCloud(`${searchLang} Songs`, limit);
  }

  // platform === 'all': interleave from all 3 platforms
  const [jioRes, ytRes, scRes] = await Promise.allSettled([
    getTrendingSaavnSongs(language),
    searchYouTubeMusic(`${searchLang} trending`, 12),
    searchSoundCloud(`${searchLang} trending`, 10),
  ]);

  const jioSongs: ExploreSong[] =
    jioRes.status === 'fulfilled'
      ? jioRes.value.map((s) => ({
          ...s,
          source: 'jiosaavn' as AudioSourcePlatform,
          sourceBadge: SOURCE_BADGES.jiosaavn,
          quality: '320kbps',
        }))
      : [];
  const ytSongs = ytRes.status === 'fulfilled' ? ytRes.value : [];
  const scSongs = scRes.status === 'fulfilled' ? scRes.value : [];

  const combined: ExploreSong[] = [];
  const maxLen = Math.max(jioSongs.length, ytSongs.length, scSongs.length);
  for (let i = 0; i < maxLen; i++) {
    if (jioSongs[i]) combined.push(jioSongs[i]);
    if (ytSongs[i]) combined.push(ytSongs[i]);
    if (scSongs[i]) combined.push(scSongs[i]);
  }

  return combined.slice(0, limit);
}

