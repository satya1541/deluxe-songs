import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, PREFIX } from '@/lib/s3';
import * as mm from 'music-metadata';
import { cleanTitle, cleanArtist } from '@/lib/text-cleaner';

export async function GET(request: Request, { params }: { params: { filename: string } }) {
  try {
    const filename = decodeURIComponent(params.filename);
    const key = `${PREFIX}${filename}`;
    
    // We only need the first 500KB to parse ID3v2 tags (where metadata usually is).
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      // For some files we might need the whole file, but 500KB is a good balance for speed vs success rate
      Range: 'bytes=0-512000'
    });
    
    const response = await s3Client.send(command);
    
    if (response.Body) {
      const byteArray = await response.Body.transformToByteArray();
      const buffer = Buffer.from(byteArray);
      
      const metadata = await mm.parseBuffer(buffer, undefined, { duration: false, skipCovers: true });
      
      return NextResponse.json({
        title: metadata.common.title ? cleanTitle(metadata.common.title) : undefined,
        artist: metadata.common.artist ? cleanArtist(metadata.common.artist) : undefined,
        album: metadata.common.album
      });
    }
  } catch (err: any) {
    // If it fails (e.g. tag not in first 500KB), return empty so client can fallback to filename
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  
  return NextResponse.json({ error: 'No body' }, { status: 400 });
}
