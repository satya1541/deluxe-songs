import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const rawFileName = params.filename || '';
    const decodedName = decodeURIComponent(rawFileName);
    const safeName = path.basename(decodedName);

    const musicDir = path.join(process.cwd(), 'public', 'music');
    const filePath = path.join(musicDir, safeName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Audio file "${safeName}" not found on disk` },
        { status: 404 }
      );
    }

    const stat = await fs.promises.stat(filePath);
    const fileSize = stat.size;
    const range = request.headers.get('range');

    const ext = path.extname(safeName).toLowerCase();
    let contentType = 'audio/mpeg';
    if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.ogg') contentType = 'audio/ogg';
    else if (ext === '.m4a' || ext === '.aac') contentType = 'audio/aac';
    else if (ext === '.flac') contentType = 'audio/flac';

    // Support HTTP Range Requests (Audio Seeking & Partial Content)
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = fs.createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } else {
      const nodeStream = fs.createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      return new NextResponse(webStream, {
        status: 200,
        headers: {
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  } catch (error: any) {
    console.error('Audio stream error:', error);
    return NextResponse.json({ error: 'Failed to stream audio' }, { status: 500 });
  }
}
