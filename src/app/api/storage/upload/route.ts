/**
 * Upload Objects API
 * POST /api/storage/upload - Upload a file to a bucket
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadObject, isMinioEnabled } from '@/server/storage/minio.service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const bucket = formData.get('bucket') as string | null;
        const prefix = formData.get('prefix') as string | '';

        if (!file) {
            return NextResponse.json(
                { error: 'File is required' },
                { status: 400 }
            );
        }

        if (!bucket) {
            return NextResponse.json(
                { error: 'Bucket name is required' },
                { status: 400 }
            );
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Construct object name with prefix
        const objectName = prefix ? `${prefix}${file.name}` : file.name;

        const result = await uploadObject(
            bucket,
            objectName,
            buffer,
            buffer.length,
            file.type || 'application/octet-stream'
        );

        return NextResponse.json({
            success: true,
            objectName,
            size: buffer.length,
            etag: result.etag,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload file' },
            { status: 500 }
        );
    }
}
