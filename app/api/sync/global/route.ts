import { NextResponse } from 'next/server';
import { ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME, PREFIX } from '@/lib/s3';
import { Song } from '@/types/music';
import { GlobalRadioState } from '@/types/sync';
import path from 'path';
import { cleanTitle, cleanArtist } from '@/lib/text-cleaner';
import { ensureSongMetadata, dynamicDurationsMap } from '@/lib/song-scanner';

const DEFAULT_DURATION = 240; // 4 minutes per track standard rotation cycle

const FALLBACK_COVERS = [
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&auto=format&fit=crop&q=80',
];

function parseFilename(fileName: string): { name: string; artist: string } {
  let cleaned = fileName.replace(/\.(mp3|wav|ogg|m4a|flac)$/i, '');
  cleaned = cleaned.replace(/320 ?Kbps|128 ?Kbps|PagalNew|Pagalworld|Paglasongs/gi, '').trim();
  const parts = cleaned.split(/[-–—_]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { name: parts[0], artist: cleanArtist(parts.slice(1).join(' - ')) };
  }
  return { name: cleaned || fileName, artist: 'Unknown Artist' };
}

// In-memory cache for song list with 50-minute stable presigned URLs
let cachedSongs: Song[] = [];
let lastFetchedTime = 0;
const CACHE_TTL_MS = 50 * 60 * 1000; // 50 minutes stable cache

async function getCachedSongs(): Promise<Song[]> {
  const now = Date.now();
  if (cachedSongs.length > 0 && now - lastFetchedTime < CACHE_TTL_MS) {
    return cachedSongs;
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: PREFIX,
    });
    const response = await s3Client.send(command);
    const contents = response.Contents || [];
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];

    const audioFiles = contents.filter((item) => {
      if (!item.Key || item.Key === PREFIX) return false;
      const ext = path.extname(item.Key).toLowerCase();
      return audioExtensions.includes(ext);
    });

    const songs: Song[] = await Promise.all(
      audioFiles.map(async (file, index) => {
        const fileName = path.basename(file.Key!);
        const meta = await ensureSongMetadata(fileName, file.Key);

        const name = meta.title || fileName.replace(/\.(mp3|wav|m4a|ogg|flac|aac)$/i, '');
        const artist = meta.artist || 'Unknown Artist';
        const cover = `/api/cover/${encodeURIComponent(fileName)}?fallbackIndex=${index % FALLBACK_COVERS.length}`;

        const getCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: file.Key! });
        const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 7200 }); // 2 hours

        return {
          id: index + 1,
          name,
          artist,
          file: presignedUrl,
          fileName,
          cover,
        };
      })
    );

    if (songs.length > 0) {
      cachedSongs = songs;
      lastFetchedTime = now;
    }
    return songs;
  } catch (error) {
    console.error('Error in getCachedSongs for global sync:', error);
    return cachedSongs;
  }
}

// Real-time connected client heartbeat registry
const activeListenersMap = new Map<string, number>(); // clientId -> lastSeenEpochMs
const HEARTBEAT_TIMEOUT_MS = 16000; // 16 seconds timeout

function updateAndGetRealtimeListeners(clientId?: string | null, isLeaving?: boolean): number {
  const now = Date.now();
  if (clientId) {
    if (isLeaving) {
      activeListenersMap.delete(clientId);
    } else {
      activeListenersMap.set(clientId, now);
    }
  }

  // Purge dead/expired client connections
  activeListenersMap.forEach((lastSeen, id) => {
    if (now - lastSeen > HEARTBEAT_TIMEOUT_MS) {
      activeListenersMap.delete(id);
    }
  });

  return Math.max(1, activeListenersMap.size);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const action = searchParams.get('action');
    const isLeaving = action === 'leave';

    const activeListeners = updateAndGetRealtimeListeners(clientId, isLeaving);

    const songs = await getCachedSongs();
    if (!songs || songs.length === 0) {
      return NextResponse.json({ error: 'No songs available for broadcast' }, { status: 404 });
    }

    const now = Date.now();
    
    // Exact durations for all songs
    const durations: number[] = songs.map((s) => {
      const dur = dynamicDurationsMap[s.fileName || ''];
      return dur && dur > 30 ? dur : 240;
    });

    const totalCycleMs = durations.reduce((acc, d) => acc + (d * 1000), 0);
    const cyclePositionMs = now % totalCycleMs;

    let currentIndex = 0;
    let elapsedMs = 0;
    let accumulatedMs = 0;

    for (let i = 0; i < songs.length; i++) {
      const songMs = durations[i] * 1000;
      if (cyclePositionMs < accumulatedMs + songMs) {
        currentIndex = i;
        elapsedMs = cyclePositionMs - accumulatedMs;
        break;
      }
      accumulatedMs += songMs;
    }

    const currentSong = songs[currentIndex];
    const currentSongDuration = durations[currentIndex];
    const nextIndex = (currentIndex + 1) % songs.length;
    const nextSong = songs[nextIndex];
    const elapsedSec = elapsedMs / 1000;
    const startedAt = now - elapsedMs;

    const state: GlobalRadioState = {
      song: currentSong,
      startedAt,
      elapsedSec,
      durationSec: currentSongDuration,
      nextSong,
      activeListeners,
      serverTime: now,
    };

    return NextResponse.json({
      success: true,
      state,
      songsCount: songs.length,
      totalBroadcastDurationSec: totalCycleMs / 1000,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch global radio' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { clientId, action } = body;
    const isLeaving = action === 'leave';
    const activeListeners = updateAndGetRealtimeListeners(clientId, isLeaving);

    return NextResponse.json({ success: true, activeListeners });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 400 });
  }
}
