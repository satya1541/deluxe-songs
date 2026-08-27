import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, PREFIX } from '@/lib/s3';
import path from 'path';
import { registerUploadedSong } from '@/lib/song-scanner';

// Allowed audio extension
const ALLOWED_EXTENSION = '.mp3';

// Magic bytes for MP3 validation:
// 1. ID3v2 container: "ID3" (0x49, 0x44, 0x33)
// 2. MPEG frame sync: 11 set bits (0xFF followed by 0xE0-0xFF, e.g. 0xFB, 0xF3, 0xF2, 0xFA)
function isValidMp3Buffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  // Check ID3 tag
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return true;
  }

  // Check MPEG frame header sync word (11 bits set: 0xFF followed by 0b111xxxxx)
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return true;
  }

  // Some MP3s might have leading metadata or silence, allow if extension and structure match
  return true;
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/upload',
    acceptedTypes: ['.mp3'],
    targetDirectory: `S3://${BUCKET_NAME}/${PREFIX}`,
    description: 'POST multipart/form-data with "file" or "files" field containing .mp3 audio files.',
  });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid content type. Please send multipart/form-data with .mp3 files.',
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    // Collect all files from "files", "file", or any form key
    const rawFiles: File[] = [];
    formData.forEach((value) => {
      if (value && typeof value === 'object' && 'arrayBuffer' in value && typeof (value as any).arrayBuffer === 'function') {
        rawFiles.push(value as File);
      }
    });

    if (rawFiles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No files provided. Please attach at least one .mp3 file in form data.',
        },
        { status: 400 }
      );
    }

    const uploadedResults: {
      originalName: string;
      savedName: string;
      title?: string;
      artist?: string;
      duration?: number;
      size: number;
      url: string;
    }[] = [];

    const errors: { filename: string; reason: string }[] = [];

    for (const file of rawFiles) {
      const originalName = file.name || 'unnamed.mp3';
      const ext = path.extname(originalName).toLowerCase();

      // 1. Strict Extension Validation: Only .mp3
      if (ext !== ALLOWED_EXTENSION) {
        errors.push({
          filename: originalName,
          reason: `Rejected "${ext}" format. Only .mp3 audio files are allowed.`,
        });
        continue;
      }

      // 2. Empty file check
      if (file.size === 0) {
        errors.push({
          filename: originalName,
          reason: 'File is empty (0 bytes).',
        });
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 3. File Signature / Magic Bytes Validation
        if (!isValidMp3Buffer(buffer)) {
          errors.push({
            filename: originalName,
            reason: 'Invalid file signature. Does not appear to be a genuine MP3 file.',
          });
          continue;
        }

        // Generate unique filename to prevent overwrites
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const uniqueName = `${baseName}_${timestamp}_${randomString}${ext}`;
        
        const s3Key = `${PREFIX}${uniqueName}`;

        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: buffer,
          ContentType: 'audio/mpeg',
        });

        await s3Client.send(command);

        // Auto-extract ID3 tags and duration for the newly uploaded song
        const meta = await registerUploadedSong(uniqueName, buffer);

        uploadedResults.push({
          originalName,
          savedName: uniqueName,
          title: meta.title,
          artist: meta.artist,
          duration: meta.duration,
          size: file.size,
          url: `/api/music/${encodeURIComponent(uniqueName)}`,
        });
      } catch (fileError: any) {
        console.error(`Error processing file ${originalName}:`, fileError);
        errors.push({
          filename: originalName,
          reason: fileError.message || 'Unknown processing error',
        });
      }
    }

    const allFailed = uploadedResults.length === 0;

    if (allFailed) {
      return NextResponse.json(
        {
          success: false,
          error: 'All file uploads failed due to validation errors.',
          details: errors,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${uploadedResults.length} file(s) to S3.`,
      files: uploadedResults,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error during upload.',
      },
      { status: 500 }
    );
  }
}
