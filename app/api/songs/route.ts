import { NextResponse } from 'next/server';
import { ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME, PREFIX } from '@/lib/s3';
import { Song } from '@/types/music';
import path from 'path';
import { cleanTitle, cleanArtist } from '@/lib/text-cleaner';

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
  // Remove extension
  let cleaned = fileName.replace(/\.(mp3|wav|ogg|m4a|flac)$/i, '');
  
  // Clean up common quality/website tags from filename
  cleaned = cleaned.replace(/320 ?Kbps|128 ?Kbps|PagalNew|Pagalworld|Paglasongs/gi, '');
  cleaned = cleaned.trim();

  // Try splitting by common separators like hyphens
  const parts = cleaned.split(/[-–—_]/).map((p) => p.trim()).filter(Boolean);

  if (parts.length >= 2) {
    // Usually "Title - Artist" or "Artist - Title"
    return { name: parts[0], artist: cleanArtist(parts.slice(1).join(' - ')) };
  }

  // If no hyphen found, try to guess. The whole thing might be the title.
  // The artist can't be easily guessed, so we'll leave it as "Unknown Artist".
  // (We'll fetch actual metadata dynamically on the client side!)
  return { name: cleaned || fileName, artist: 'Unknown Artist' };
}

export async function GET() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: PREFIX,
    });

    const response = await s3Client.send(command);
    const contents = response.Contents || [];

    const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
    
    // Filter out the "Music/" folder object itself and keep only audio files
    const audioFiles = contents.filter((item) => {
      if (!item.Key || item.Key === PREFIX) return false;
      const ext = path.extname(item.Key).toLowerCase();
      return audioExtensions.includes(ext);
    });

    const songs: Song[] = await Promise.all(
      audioFiles.map(async (file, index) => {
        // file.Key is like "Music/song.mp3"
        const fileName = path.basename(file.Key!);
        const fallback = parseFilename(fileName);
        
        let name = cleanTitle(fallback.name) || fileName.replace(/\.(mp3|wav|m4a|ogg|flac|aac)$/i, '');
        let artist = cleanArtist(fallback.artist);
        
        // Pass index to cover route so it can fallback to the correct default image
        let cover = `/api/cover/${encodeURIComponent(fileName)}?fallbackIndex=${index % FALLBACK_COVERS.length}`;

        // Generate presigned URL directly to eliminate the 302 redirect delay
        const getCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: file.Key! });
        const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

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

    return NextResponse.json(songs, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error scanning S3 bucket:', error);
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

    // Strip leading "/api/music/" or "/music/" if present
    if (targetFileName.startsWith('/api/music/')) {
      targetFileName = targetFileName.replace(/^\/api\/music\//, '');
    } else if (targetFileName.startsWith('/music/')) {
      targetFileName = targetFileName.replace(/^\/music\//, '');
    }
    // Decode URI component (e.g. spaces %20)
    targetFileName = decodeURIComponent(targetFileName);

    // Sanitize to prevent path traversal
    const safeBaseName = path.basename(targetFileName);
    const s3Key = `${PREFIX}${safeBaseName}`;

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(command);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted "${safeBaseName}" from S3 library`,
      deletedFile: safeBaseName,
    });
  } catch (error: any) {
    console.error('Error deleting song from S3:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete song' },
      { status: 500 }
    );
  }
}
