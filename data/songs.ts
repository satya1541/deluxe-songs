import fs from 'fs';
import path from 'path';
import { Song } from '@/types/music';

const COVERS = [
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
  const baseName = fileName.replace(/\.(mp3|wav|m4a|ogg|flac|aac)$/i, '');
  const cleanName = baseName
    .replace(/\([^)]*OdiaBazar[^)]*\)/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();

  const parts = cleanName.split('-').map((p) => p.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return { name: parts[0], artist: parts.slice(1).join(' - ') };
  }

  const name = cleanName.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  return { name: name || fileName, artist: 'Deluxe Mix' };
}

/**
 * Dynamically scans the public/music directory for any audio files.
 * Automatically discovers new songs added to public/music without hardcoding.
 */
export function getDiscoveredSongs(): Song[] {
  try {
    const musicDir = path.join(process.cwd(), 'public', 'music');
    if (!fs.existsSync(musicDir)) return [];

    const files = fs.readdirSync(musicDir);
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];

    const audioFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return audioExtensions.includes(ext);
    });

    return audioFiles.map((file, index) => {
      const { name, artist } = parseFilename(file);
      return {
        id: index + 1,
        name,
        artist,
        file: `/music/${file}`,
        cover: COVERS[index % COVERS.length],
      };
    });
  } catch (error) {
    console.error('Error scanning public/music folder:', error);
    return [];
  }
}

// Fallback exported array for initial SSR render
export const SONGS: Song[] = getDiscoveredSongs();
