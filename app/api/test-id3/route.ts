import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, PREFIX } from '@/lib/s3';
import * as mm from 'music-metadata';

export async function GET(request: Request) {
  try {
    const key = `${PREFIX}Sajni Laapataa Ladies 320 Kbps.mp3`;
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    
    const response = await s3Client.send(command);
    const byteArray = await response.Body!.transformToByteArray();
    const buffer = Buffer.from(byteArray);
    
    // We must omit mimeType or options if we don't know it, or pass an empty object.
    const metadata = await mm.parseBuffer(buffer, undefined, { duration: false, skipCovers: true });
    
    return NextResponse.json({
      title: metadata.common.title,
      artist: metadata.common.artist,
      album: metadata.common.album
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
