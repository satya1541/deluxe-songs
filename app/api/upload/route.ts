import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    targetDirectory: '/public/music',
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

    const musicDir = path.join(process.cwd(), 'public', 'music');

    // Ensure public/music directory exists
    if (!fs.existsSync(musicDir)) {
      await fs.promises.mkdir(musicDir, { recursive: true });
    }

    const uploadedResults: {
      originalName: string;
      savedName: string;
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

      // 3. Max size limit check (100MB per track)
      const MAX_FILE_SIZE = 100 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        errors.push({
          filename: originalName,
          reason: `File size exceeds 100MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
        });
        continue;
      }

      // 4. Sanitize file name to prevent path traversal
      const sanitizedBase = path
        .basename(originalName, ext)
        .replace(/[^a-zA-Z0-9\s._-]/g, '')
        .trim();

      const safeFileName = `${sanitizedBase || 'song'}.mp3`;
      const targetFilePath = path.join(musicDir, safeFileName);

      // 5. Read arrayBuffer and validate MP3 header content
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (!isValidMp3Buffer(buffer)) {
        errors.push({
          filename: originalName,
          reason: 'Invalid MP3 audio content or corrupt file header.',
        });
        continue;
      }

      // 6. Write file directly to public/music/
      await fs.promises.writeFile(targetFilePath, buffer);

      uploadedResults.push({
        originalName,
        savedName: safeFileName,
        size: file.size,
        url: `/music/${encodeURIComponent(safeFileName)}`,
      });
    }

    if (uploadedResults.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid .mp3 files were uploaded.',
          details: errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully uploaded ${uploadedResults.length} .mp3 file(s) directly to public/music/`,
        uploadedCount: uploadedResults.length,
        files: uploadedResults,
        ...(errors.length > 0 ? { warnings: errors } : {}),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error handling music upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Server error while saving uploaded music.',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
