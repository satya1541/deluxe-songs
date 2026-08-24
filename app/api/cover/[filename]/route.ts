import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, PREFIX } from '@/lib/s3';
import * as mm from 'music-metadata';

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

export async function GET(request: Request, { params }: { params: { filename: string } }) {
  const { searchParams } = new URL(request.url);
  const fallbackIndex = parseInt(searchParams.get('fallbackIndex') || '0', 10);
  const fallbackUrl = FALLBACK_COVERS[fallbackIndex % FALLBACK_COVERS.length];

  try {
    const filename = decodeURIComponent(params.filename);
    const key = `${PREFIX}${filename}`;
    
    // We only need the first 500KB to parse ID3v2 tags (where covers usually are).
    // This makes the request very fast compared to downloading the entire MP3.
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Range: 'bytes=0-512000'
    });
    
    const response = await s3Client.send(command);
    
    if (response.Body) {
      // Fetch the stream into a buffer
      const byteArray = await response.Body.transformToByteArray();
      const buffer = Buffer.from(byteArray);
      
      const metadata = await mm.parseBuffer(buffer, 'audio/mpeg', { duration: false, skipPostHeaders: true });
      const picture = metadata.common.picture?.[0];
      
      if (picture && picture.data) {
        return new NextResponse(Buffer.from(picture.data), {
          headers: {
            'Content-Type': picture.format,
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        });
      }
    }
  } catch (err: any) {
    // If Range request fails (e.g. file too small or other S3 error), we just ignore and fallback.
    // Also ignore music-metadata parsing errors if the ID3 tag isn't in the first 500KB.
    console.warn(`Could not extract cover for ${params.filename}:`, err.message);
  }
  
  // Return redirect to the fallback image
  return NextResponse.redirect(new URL(fallbackUrl, request.url));
}
