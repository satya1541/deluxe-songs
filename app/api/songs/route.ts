import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';
import { Song } from '@/types/music';

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

export async function GET() {
  try {
    const musicDir = path.join(process.cwd(), 'public', 'music');

    if (!fs.existsSync(musicDir)) {
      return NextResponse.json([]);
    }

    const files = await fs.promises.readdir(musicDir);
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
    const audioFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return audioExtensions.includes(ext);
    });

    const songs: Song[] = await Promise.all(
      audioFiles.map(async (file, index) => {
        const filePath = path.join(musicDir, file);
        let name = '';
        let artist = '';
        let cover = FALLBACK_COVERS[index % FALLBACK_COVERS.length];

        try {
          // Extract ID3 tags & embedded picture from MP3 metadata
          const metadata = await parseFile(filePath, { duration: false });
          const common = metadata.common;

          if (common.title) name = common.title;
          if (common.artist) artist = common.artist;

          // Check for embedded album cover art image
          if (common.picture && common.picture.length > 0) {
            const pic = common.picture[0];
            const base64Data = Buffer.from(pic.data).toString('base64');
            cover = `data:${pic.format};base64,${base64Data}`;
          }
        } catch (err) {
          console.warn(`Could not parse ID3 metadata for ${file}:`, err);
        }

        // Fallback to filename parsing if ID3 tags are missing
        if (!name || !artist) {
          const fallback = parseFilename(file);
          if (!name) name = fallback.name;
          if (!artist) artist = fallback.artist;
        }

        return {
          id: index + 1,
          name,
          artist,
          file: `/music/${file}`,
          fileName: file,
          cover,
        };
      })
    );

    return NextResponse.json(songs, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error scanning music directory:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let targetFileName = (body.fileName || body.file || body.name || '').trim();

    if (!targetFileName) {
      return NextResponse.json(
        { success: false, error: 'File name or path is required for deletion' },
        { status: 400 }
      );
    }

    // Strip leading "/music/" if present
    if (targetFileName.startsWith('/music/')) {
      targetFileName = targetFileName.replace(/^\/music\//, '');
    }
    // Decode URI component (e.g. spaces %20)
    targetFileName = decodeURIComponent(targetFileName);

    // Sanitize to prevent path traversal
    const safeBaseName = path.basename(targetFileName);
    const musicDir = path.join(process.cwd(), 'public', 'music');
    const targetFilePath = path.join(musicDir, safeBaseName);

    if (!fs.existsSync(targetFilePath)) {
      return NextResponse.json(
        { success: false, error: `File "${safeBaseName}" not found in public/music/` },
        { status: 404 }
      );
    }

    // Delete the file from public/music/
    await fs.promises.unlink(targetFilePath);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted "${safeBaseName}" from library`,
      deletedFile: safeBaseName,
    });
  } catch (error: any) {
    console.error('Error deleting song:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete song' },
      { status: 500 }
    );
  }
}

