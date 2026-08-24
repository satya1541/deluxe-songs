import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME, PREFIX } from '@/lib/s3';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const rawFileName = params.filename || '';
    const decodedName = decodeURIComponent(rawFileName);
    const safeName = path.basename(decodedName);

    const s3Key = `${PREFIX}${safeName}`;

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    // Generate a presigned URL valid for 1 hour
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Redirect the browser/audio player to the presigned S3 URL.
    // The browser will automatically follow this redirect and pass along
    // any HTTP Range headers natively to S3 for perfect seeking/scrubbing.
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
