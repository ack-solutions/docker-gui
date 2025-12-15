/**
 * Object Metadata API
 * GET /api/storage/metadata - Get detailed metadata for an object
 */

import { NextRequest, NextResponse } from 'next/server';
import { getObjectMetadata, isMinioEnabled } from '@/server/storage/minio.service';

export async function GET(request: NextRequest) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const { searchParams } = new URL(request.url);
        const bucket = searchParams.get('bucket');
        const objectName = searchParams.get('objectName');

        if (!bucket || !objectName) {
            return NextResponse.json(
                { error: 'Bucket and objectName are required' },
                { status: 400 }
            );
        }

        const metadata = await getObjectMetadata(bucket, objectName);

        return NextResponse.json(metadata);
    } catch (error) {
        console.error('Get metadata error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to get metadata' },
            { status: 500 }
        );
    }
}
