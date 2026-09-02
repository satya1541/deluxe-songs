import CryptoJS from 'crypto-js';
import { ExploreSong, SourceBadge } from '@/types/explore';

const JIOSAAVN_BADGE: SourceBadge = {
  name: 'Lossless',
  icon: '⚡',
  logoUrl: '/lossless-logo.jpeg',
  color: '#22c55e',
  bg: 'rgba(34, 197, 94, 0.12)',
  border: 'rgba(34, 197, 94, 0.3)',
  qualityLabel: 'Lossless',
};

const SAAVN_DES_KEY = '38346591';

/**
 * Decrypts JioSaavn's encrypted_media_url into the raw Akamai/Jio CDN URL.
 */
export function decryptSaavnMediaUrl(encUrl: string): string | null {
  if (!encUrl) return null;
  try {
    const key = CryptoJS.enc.Utf8.parse(SAAVN_DES_KEY);
    const decrypted = CryptoJS.DES.decrypt(
      encUrl,
      key,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    );
    const rawUrl = decrypted.toString(CryptoJS.enc.Utf8);
    if (!rawUrl || !rawUrl.startsWith('http')) {
      return null;
    }
    return rawUrl;
  } catch (err) {
    console.error('Error decrypting Saavn media URL:', err);
    return null;
  }
}

/**
 * Transforms raw Saavn media URL to pristine 320kbps (or highest available).
 */
export function getHighQualityStreamUrl(rawUrl: string, has320Kbps: boolean = true): { url: string; quality: '320kbps' | '160kbps' | '96kbps' } {
  if (has320Kbps && rawUrl.includes('_96.')) {
    return { url: rawUrl.replace('_96.', '_320.'), quality: '320kbps' };
  }
  if (has320Kbps && rawUrl.includes('_160.')) {
    return { url: rawUrl.replace('_160.', '_320.'), quality: '320kbps' };
  }
  if (rawUrl.includes('_96.')) {
    return { url: rawUrl.replace('_96.', '_160.'), quality: '160kbps' };
  }
  return { url: rawUrl, quality: '160kbps' };
}

/**
 * Cleans HTML entities and escaped characters in strings.
 */
export function unescapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

const artistImageCache = new Map<string, string>();
const DEEZER_BLANK_MD5 = 'd41d8cd98f00b204e9800998ecf8427e';

/**
 * Fetches real, official high-res portrait for an artist using Deezer, iTunes, or Saavn.
 */
export async function fetchRealArtistImage(artistName: string, rawImageUrl?: string): Promise<string> {
  // If rawImageUrl is already a valid high-res image (not our stock placeholder)
  if (rawImageUrl && typeof rawImageUrl === 'string' && rawImageUrl.startsWith('http') && !rawImageUrl.includes('photo-1511671782779-c97d3d27a1d4')) {
    const upgraded = rawImageUrl
      .replace(/50x50\.jpg/gi, '500x500.jpg')
      .replace(/150x150\.jpg/gi, '500x500.jpg')
      .replace(/250x250\.jpg/gi, '500x500.jpg');
    if (!upgraded.includes('default_artist') && !upgraded.includes('c.saavncdn.com/artists/default')) {
      return upgraded;
    }
  }

  // Clean artist name: if it contains delimiters like ';', ',', take the prominent artist
  const cleanName = (artistName || '')
    .split(/[,;&|]/)[0]
    .replace(/\b(feat|ft|featuring)\b.*$/i, '')
    .trim();

  if (!cleanName) {
    return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  }

  const cacheKey = cleanName.toLowerCase();
  if (artistImageCache.has(cacheKey)) {
    return artistImageCache.get(cacheKey)!;
  }

  try {
    // 1. Try Deezer Artist Search (high quality 500x500 portrait)
    const deezerRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(cleanName)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (deezerRes.ok) {
      const data = await deezerRes.json();
      const pic = data.data?.[0]?.picture_big || data.data?.[0]?.picture_medium;
      if (pic && !pic.includes(DEEZER_BLANK_MD5)) {
        artistImageCache.set(cacheKey, pic);
        return pic;
      }
    }
  } catch {}

  try {
    // 2. Try iTunes Apple Music Search CDN (600x600 HD artwork)
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanName)}&entity=song&limit=1`, {
      headers: { 'Accept': 'application/json' },
    });
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      const rawThumb = itunesData.results?.[0]?.artworkUrl100;
      if (rawThumb) {
        const hdPic = rawThumb.replace('100x100bb', '600x600bb');
        artistImageCache.set(cacheKey, hdPic);
        return hdPic;
      }
    }
  } catch {}

  try {
    // 3. Try JioSaavn Artist Search API
    const saavnUrl = `https://www.jiosaavn.com/api.php?__call=search.getArtistResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(cleanName)}&p=1&n=1`;
    const sRes = await fetch(saavnUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (sRes.ok) {
      const sData = await sRes.json();
      const saavnImg = sData.results?.[0]?.image;
      if (saavnImg && typeof saavnImg === 'string' && saavnImg.startsWith('http')) {
        const hdSaavn = saavnImg.replace(/50x50\.jpg/gi, '500x500.jpg').replace(/150x150\.jpg/gi, '500x500.jpg');
        artistImageCache.set(cacheKey, hdSaavn);
        return hdSaavn;
      }
    }
  } catch {}

  const fallback = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  artistImageCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Upgrades image URL to 500x500 HD resolution.
 */
export function getHdCoverArt(imageUrl: string): string {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
    return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  }
  return imageUrl
    .replace(/50x50\.jpg/gi, '500x500.jpg')
    .replace(/150x150\.jpg/gi, '500x500.jpg')
    .replace(/250x250\.jpg/gi, '500x500.jpg');
}

/**
 * Formats a raw JioSaavn song object into an ExploreSong.
 */
export function formatSaavnSong(raw: any): ExploreSong | null {
  try {
    const encUrl = raw.more_info?.encrypted_media_url || raw.encrypted_media_url;
    const rawDecrypted = decryptSaavnMediaUrl(encUrl);
    if (!rawDecrypted) return null;

    const has320 = raw.more_info?.['320kbps'] === 'true' || raw.more_info?.['320kbps'] === true;
    const { url: streamUrl, quality } = getHighQualityStreamUrl(rawDecrypted, has320);

    // Primary artists
    let artist = 'Various Artists';
    const primaryArtists = raw.more_info?.artistMap?.primary_artists;
    if (Array.isArray(primaryArtists) && primaryArtists.length > 0) {
      artist = primaryArtists.map((a: any) => a.name).join(', ');
    } else if (raw.more_info?.singers) {
      artist = raw.more_info.singers;
    } else if (raw.more_info?.music) {
      artist = raw.more_info.music;
    }

    const duration = parseInt(raw.more_info?.duration || raw.duration || '240', 10);
    const cover = getHdCoverArt(raw.image);

    return {
      id: String(raw.id || Math.random()),
      name: unescapeHtml(raw.title || raw.song || 'Unknown Song'),
      artist: unescapeHtml(artist),
      album: unescapeHtml(raw.more_info?.album || raw.album || 'Single'),
      year: raw.year || raw.more_info?.year || '',
      duration: isNaN(duration) ? 240 : duration,
      cover,
      streamUrl: `/api/explore/stream?url=${encodeURIComponent(streamUrl)}`,
      quality,
      language: raw.language || raw.more_info?.language || 'Hindi',
      hasLyrics: raw.more_info?.has_lyrics === 'true',
    };
  } catch (err) {
    console.error('Error formatting Saavn song:', err);
    return null;
  }
}

/**
 * Searches JioSaavn for songs matching a query.
 */
export async function searchSaavnSongs(query: string, page: number = 1, limit: number = 25): Promise<ExploreSong[]> {
  if (!query || !query.trim()) return [];

  const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query)}&p=${page}&n=${limit}`;
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
    next: { revalidate: 3600 }, // Cache search queries for 1 hour
  });

  if (!res.ok) return [];

  const data = await res.json();
  const rawResults = data.results || [];
  const songs: ExploreSong[] = [];

  for (const raw of rawResults) {
    const formatted = formatSaavnSong(raw);
    if (formatted) songs.push(formatted);
  }

  return songs;
}

const CHART_PLAYLISTS: Record<string, string> = {
  'all': '1134595537', // International : India Superhits Top 50 (Global)
  'hindi': '1134543272',
  'punjabi': '1134543511',
  'english': '1134595537',
  'tamil': '1134651042',
  'telugu': '1134643225',
  'bhojpuri': '1134768973',
  'bengali': '1134638573',
  'malayalam': '1134705865',
  'kannada': '1134591169',
  'marathi': '1134710071',
  'gujarati': '1134743773',
  'haryanvi': '1134770917',
  'odia': '1134670616'
};

/**
 * Fetches trending songs or editorial charts for a language.
 */
export async function getTrendingSaavnSongs(language: string = 'all'): Promise<ExploreSong[]> {
  const langLower = language.toLowerCase();
  
  // If unsupported language, default to Hindi charts. 'all' is now mapped to Global Top 50.
  const listId = CHART_PLAYLISTS[langLower] || CHART_PLAYLISTS['hindi'];
  
  const url = `https://www.jiosaavn.com/api.php?__call=playlist.getDetails&_format=json&listid=${listId}&api_version=4`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const rawResults = data.list || [];
  const songs: ExploreSong[] = [];

  for (const raw of rawResults) {
    const formatted = formatSaavnSong(raw);
    if (formatted) songs.push(formatted);
  }

  return songs;
}

/**
 * Searches JioSaavn for artists matching a query.
 */
export async function searchSaavnArtists(query: string, limit: number = 5) {
  if (!query || !query.trim()) return [];

  const url = `https://www.jiosaavn.com/api.php?__call=search.getArtistResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query)}&p=1&n=${limit}`;
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const rawResults = data.results || [];
  
  return Promise.all(
    rawResults.map(async (raw: any) => {
      const artistName = unescapeHtml(raw.name || raw.title || 'Unknown Artist');
      const cover = await fetchRealArtistImage(artistName, raw.image);
      return {
        id: `jio_art_${raw.id}`,
        name: artistName,
        cover,
        role: raw.role || raw.description || 'Artist',
        type: 'artist' as const,
        source: 'jiosaavn' as const
      };
    })
  );
}

/**
 * Searches JioSaavn for albums matching a query.
 */
export async function searchSaavnAlbums(query: string, limit: number = 5) {
  if (!query || !query.trim()) return [];

  const url = `https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(query)}&p=1&n=${limit}`;
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const rawResults = data.results || [];
  
  return rawResults.map((raw: any) => ({
    id: `jio_alb_${raw.id}`,
    name: unescapeHtml(raw.title || 'Unknown Album'),
    artist: unescapeHtml(raw.music || raw.more_info?.music || 'Various Artists'),
    year: raw.year || '',
    cover: getHdCoverArt(raw.image),
    type: 'album',
    source: 'jiosaavn'
  }));
}

export interface SaavnArtistDetails {
  id: string;
  name: string;
  image: string;
  followerCount: string;
  fanCount: string;
  isVerified: boolean;
  dominantLanguage: string;
  bio?: string;
  dob?: string;
  topSongs: ExploreSong[];
  topAlbums: Array<{
    id: string;
    name: string;
    year: string;
    image: string;
    songCount?: string;
    language?: string;
    releaseType?: 'album' | 'single';
  }>;
  similarArtists: Array<{
    id: string;
    name: string;
    image: string;
    role?: string;
  }>;
}

/**
 * Fetches full artist details, top songs, and top albums from JioSaavn.
 */
export async function getSaavnArtistDetails(artistId: string): Promise<SaavnArtistDetails | null> {
  if (!artistId) return null;
  const cleanId = artistId.replace(/^jio_art_/, '').trim();

  try {
    const pageUrl = `https://www.jiosaavn.com/api.php?__call=artist.getArtistPageDetails&_format=json&artistId=${encodeURIComponent(cleanId)}&api_version=4`;
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.name) return null;

    // Fetch up to 20 top songs
    let rawSongs: any[] = [];
    try {
      const songsUrl = `https://www.jiosaavn.com/api.php?__call=artist.getArtistMoreSong&_format=json&artistId=${encodeURIComponent(cleanId)}&p=1&n=20&api_version=4`;
      const songsRes = await fetch(songsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        next: { revalidate: 3600 },
      });
      if (songsRes.ok) {
        const songsData = await songsRes.json();
        rawSongs = songsData.topSongs?.songs || songsData.songs || songsData.top_songs || [];
      }
    } catch {}

    if (rawSongs.length === 0) {
      rawSongs = data.topSongs?.songs || data.topSongs || [];
    }

    const topSongs: ExploreSong[] = [];
    for (const raw of rawSongs) {
      const formatted = formatSaavnSong(raw);
      if (formatted) {
        topSongs.push({
          ...formatted,
          source: 'jiosaavn',
          sourceBadge: JIOSAAVN_BADGE,
        });
      }
    }

    const artistName = unescapeHtml(data.name);

    // Fetch accurate albums via search API instead of unreliable topAlbums from getArtistPageDetails
    let topAlbums: Array<{
      id: string; name: string; year: string; image: string;
      songCount: string; language: string; releaseType: 'album' | 'single';
    }> = [];
    try {
      const albumSearchUrl = `https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(artistName)}&p=1&n=50`;
      const albumSearchRes = await fetch(albumSearchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        next: { revalidate: 3600 },
      });
      if (albumSearchRes.ok) {
        const albumSearchData = await albumSearchRes.json();
        const searchAlbums: any[] = albumSearchData.results || [];
        const artistNameLower = artistName.toLowerCase();
        // Filter: keep albums where the artist is the primary music director
        // and exclude large compilations (50+ songs)
        const filtered = searchAlbums.filter((a: any) => {
          const music = (a.more_info?.music || '').toLowerCase();
          const title = (a.title || '').toLowerCase();
          const songCount = parseInt(a.more_info?.song_count || '0', 10);
          // Skip huge compilations (Best Of collections, etc.)
          if (songCount > 25) return false;
          // Skip generic "Best Of" / "Top Hits" compilations
          if (title.includes('best of') || title.includes('top hits') || title.includes('world music day')) return false;
          // Keep if artist is in the music credits (primary composer/producer)
          return music.includes(artistNameLower) || music.split(',').some((m: string) => m.trim().toLowerCase().includes(artistNameLower));
        });
        topAlbums = filtered.map((a: any) => {
          const songCount = parseInt(a.more_info?.song_count || '0', 10);
          return {
            id: `jio_alb_${a.id}`,
            name: unescapeHtml(a.title || 'Unknown Album'),
            year: a.year || '',
            image: getHdCoverArt(a.image),
            songCount: a.more_info?.song_count || '',
            language: a.language || '',
            releaseType: (songCount <= 1 ? 'single' : 'album') as 'album' | 'single',
          };
        });
        // Sort by year descending so latest release is first
        topAlbums.sort((a, b) => parseInt(b.year || '0', 10) - parseInt(a.year || '0', 10));
      }
    } catch (albumErr) {
      console.warn('Album search fallback failed, using topAlbums from page details:', albumErr);
    }
    // Fallback to page details topAlbums if search returned nothing
    if (topAlbums.length === 0) {
      const rawAlbums = data.topAlbums?.albums || (Array.isArray(data.topAlbums) ? data.topAlbums : []);
      topAlbums = rawAlbums.map((a: any) => {
        const songCount = parseInt(a.more_info?.song_count || a.song_count || '0', 10);
        return {
          id: `jio_alb_${a.id}`,
          name: unescapeHtml(a.title || a.name || 'Unknown Album'),
          year: a.year || '',
          image: getHdCoverArt(a.image),
          songCount: a.more_info?.song_count || a.song_count || '',
          language: a.language || '',
          releaseType: (songCount <= 1 ? 'single' : 'album') as 'album' | 'single',
        };
      });
    }

    const rawSimilar = data.similarArtists || [];
    const similarArtists = await Promise.all(
      (Array.isArray(rawSimilar) ? rawSimilar : []).map(async (sa: any) => {
        const saName = unescapeHtml(sa.name || sa.title || 'Unknown Artist');
        const saImage = await fetchRealArtistImage(saName, sa.image);
        return {
          id: `jio_art_${sa.id || sa.artist_id}`,
          name: saName,
          image: saImage,
          role: sa.role || sa.description || 'Artist',
        };
      })
    );

    let bioText = '';
    try {
      if (typeof data.bio === 'string' && data.bio !== '[]') {
        const parsed = JSON.parse(data.bio);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
          bioText = parsed[0].text;
        } else {
          bioText = data.bio;
        }
      }
    } catch {
      bioText = typeof data.bio === 'string' ? data.bio : '';
    }

    const mainImage = await fetchRealArtistImage(artistName, data.image);

    return {
      id: `jio_art_${cleanId}`,
      name: artistName,
      image: mainImage,
      followerCount: data.follower_count || data.fan_count || '0',
      fanCount: data.fan_count || '0',
      isVerified: data.isVerified === true || data.isVerified === 'true' || Boolean(data.follower_count),
      dominantLanguage: data.dominantLanguage || '',
      bio: bioText,
      dob: data.dob || '',
      topSongs,
      topAlbums,
      similarArtists,
    };
  } catch (err) {
    console.error('Error fetching JioSaavn artist details:', err);
    return null;
  }
}

export interface SaavnAlbumDetails {
  id: string;
  name: string;
  artist: string;
  year: string;
  image: string;
  language: string;
  songs: ExploreSong[];
  songCount: number;
}

/**
 * Fetches full album details and tracklist from JioSaavn.
 */
export async function getSaavnAlbumDetails(albumId: string): Promise<SaavnAlbumDetails | null> {
  if (!albumId) return null;
  const cleanId = albumId.replace(/^jio_alb_/, '').trim();

  try {
    const url = `https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&_format=json&albumid=${encodeURIComponent(cleanId)}&api_version=4`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.title) return null;

    const rawSongs = data.list || data.songs || [];
    const songs: ExploreSong[] = [];
    for (const raw of rawSongs) {
      const formatted = formatSaavnSong(raw);
      if (formatted) {
        songs.push({
          ...formatted,
          source: 'jiosaavn',
          sourceBadge: JIOSAAVN_BADGE,
        });
      }
    }

    let artist = 'Various Artists';
    if (data.artist) artist = data.artist;
    else if (data.more_info?.artistMap?.primary_artists?.length > 0) {
      artist = data.more_info.artistMap.primary_artists.map((a: any) => a.name).join(', ');
    } else if (data.more_info?.music) {
      artist = data.more_info.music;
    }

    return {
      id: `jio_alb_${cleanId}`,
      name: unescapeHtml(data.title),
      artist: unescapeHtml(artist),
      year: data.year || data.more_info?.year || '',
      image: getHdCoverArt(data.image),
      language: data.language || '',
      songs,
      songCount: songs.length,
    };
  } catch (err) {
    console.error('Error fetching JioSaavn album details:', err);
    return null;
  }
}
