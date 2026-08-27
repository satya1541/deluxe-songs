import fs from 'fs';
import path from 'path';
import * as mm from 'music-metadata';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { cleanTitle, cleanArtist } from '@/lib/text-cleaner';
import songMetadataJson from '@/lib/song-metadata.json';
import songDurationsJson from '@/lib/song-durations.json';

// In-memory dynamic maps initialized from JSON files
export const dynamicMetadataMap: Record<string, { title: string; artist: string }> = { ...songMetadataJson };
export const dynamicDurationsMap: Record<string, number> = { ...songDurationsJson };

const METADATA_PATH = path.join(process.cwd(), 'lib', 'song-metadata.json');
const DURATIONS_PATH = path.join(process.cwd(), 'lib', 'song-durations.json');

/**
 * Persists in-memory map to disk if running in environment where disk is writable
 */
function persistToDisk() {
  try {
    fs.writeFileSync(METADATA_PATH, JSON.stringify(dynamicMetadataMap, null, 2), 'utf8');
    fs.writeFileSync(DURATIONS_PATH, JSON.stringify(dynamicDurationsMap, null, 2), 'utf8');
  } catch (err) {
    // Non-blocking in serverless/read-only production environments
    console.warn('Unable to persist song metadata to disk:', err);
  }
}

/**
 * Probes a song from S3 or buffer and ensures it has metadata & duration
 */
export async function ensureSongMetadata(fileName: string, s3Key?: string): Promise<{ title: string; artist: string; duration: number }> {
  const existingMeta = dynamicMetadataMap[fileName];
  const existingDur = dynamicDurationsMap[fileName];

  if (existingMeta && existingDur) {
    return {
      title: cleanTitle(existingMeta.title),
      artist: cleanArtist(existingMeta.artist),
      duration: existingDur,
    };
  }

  try {
    const key = s3Key || `Music/${fileName}`;
    // Fetch first 128KB of audio file to parse ID3 tags & duration header quickly
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Range: 'bytes=0-131072',
    });

    const s3Response = await s3Client.send(getCommand);
    const stream = s3Response.Body;
    if (stream) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const parsed = await mm.parseBuffer(buffer, 'audio/mpeg', { duration: true });

      const rawTitle = parsed.common.title || fileName.replace(/\.(mp3|wav|m4a|ogg|flac|aac)$/i, '');
      const rawArtist = parsed.common.artist || 'Unknown Artist';
      const dur = Math.round(parsed.format.duration || 240);

      const title = cleanTitle(rawTitle);
      const artist = cleanArtist(rawArtist);

      dynamicMetadataMap[fileName] = { title, artist };
      dynamicDurationsMap[fileName] = dur;
      persistToDisk();

      return { title, artist, duration: dur };
    }
  } catch (err) {
    console.warn(`Failed to auto-probe ID3 for ${fileName}:`, err);
  }

  // Fallback if network stream fails
  const fallbackTitle = cleanTitle(fileName);
  const fallbackArtist = 'Unknown Artist';
  const fallbackDur = 240;

  dynamicMetadataMap[fileName] = { title: fallbackTitle, artist: fallbackArtist };
  dynamicDurationsMap[fileName] = fallbackDur;

  return { title: fallbackTitle, artist: fallbackArtist, duration: fallbackDur };
}

/**
 * Registers metadata and duration from an uploaded buffer
 */
export async function registerUploadedSong(fileName: string, buffer: Buffer): Promise<{ title: string; artist: string; duration: number }> {
  try {
    const parsed = await mm.parseBuffer(buffer, 'audio/mpeg', { duration: true });
    const rawTitle = parsed.common.title || fileName.replace(/\.(mp3|wav|m4a|ogg|flac|aac)$/i, '');
    const rawArtist = parsed.common.artist || 'Unknown Artist';
    const dur = Math.round(parsed.format.duration || 240);

    const title = cleanTitle(rawTitle);
    const artist = cleanArtist(rawArtist);

    dynamicMetadataMap[fileName] = { title, artist };
    dynamicDurationsMap[fileName] = dur;
    persistToDisk();

    return { title, artist, duration: dur };
  } catch (e) {
    const title = cleanTitle(fileName);
    const artist = 'Unknown Artist';
    const duration = 240;

    dynamicMetadataMap[fileName] = { title, artist };
    dynamicDurationsMap[fileName] = duration;
    persistToDisk();

    return { title, artist, duration };
  }
}
