import CryptoJS from 'crypto-js';
import { ExploreSong } from '@/types/explore';

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

/**
 * Upgrades image URL to 500x500 HD resolution.
 */
export function getHdCoverArt(imageUrl: string): string {
  if (!imageUrl) {
    return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
  }
  return imageUrl
    .replace(/50x50\.jpg/gi, '500x500.jpg')
    .replace(/150x150\.jpg/gi, '500x500.jpg');
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

/**
 * Fetches trending songs or editorial charts for a language.
 */
export async function getTrendingSaavnSongs(language: string = 'all'): Promise<ExploreSong[]> {
  let query = 'Trending Indian & Global Hits';
  const langLower = language.toLowerCase();

  switch (langLower) {
    case 'hindi':
      query = 'Top Hindi Bollywood Hits 2025';
      break;
    case 'punjabi':
      query = 'Top Punjabi Songs Karan Aujla Diljit';
      break;
    case 'english':
      query = 'Billboard Hot 100 Global Hits';
      break;
    case 'tamil':
      query = 'Top Tamil Songs Anirudh AR Rahman';
      break;
    case 'telugu':
      query = 'Top Telugu Hits Thaman DSP';
      break;
    case 'bhojpuri':
      query = 'Top Bhojpuri Hits Pawan Singh';
      break;
    case 'bengali':
      query = 'Top Bengali Songs Arijit Singh';
      break;
    case 'malayalam':
      query = 'Top Malayalam Songs Sushin Shyam';
      break;
    case 'kannada':
      query = 'Top Kannada Songs Ravi Basrur';
      break;
    case 'marathi':
      query = 'Top Marathi Songs Ajay Atul';
      break;
    case 'gujarati':
      query = 'Top Gujarati Songs Garba';
      break;
    case 'haryanvi':
      query = 'Top Haryanvi Songs Gulzaar Chhaniwala';
      break;
    default:
      query = 'Top Trending Songs 2025';
      break;
  }

  return searchSaavnSongs(query, 1, 28);
}
