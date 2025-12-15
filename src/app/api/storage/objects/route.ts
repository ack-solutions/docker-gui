/**
 * Objects API
 * GET /api/storage/objects - List objects in a bucket
 * POST /api/storage/objects - Delete objects from a bucket
 */

import { NextRequest, NextResponse } from 'next/server';
import { listObjects, deleteObject, deleteObjects, getPresignedDownloadUrl, isMinioEnabled } from '@/server/storage/minio.service';

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
        const prefix = searchParams.get('prefix') || '';
        const recursive = searchParams.get('recursive') === 'true';
        const maxKeys = parseInt(searchParams.get('maxKeys') || '1000', 10);

        if (!bucket) {
            return NextResponse.json(
                { error: 'Bucket name is required' },
                { status: 400 }
            );
        }

        const objects = await listObjects({
            bucket,
            prefix,
            recursive,
            maxKeys,
        });

        return NextResponse.json(objects);
    } catch (error) {
        console.error('List objects error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to list objects' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const body = await request.json();
        const { action, bucket, objectName, objectNames } = body;

        if (!bucket) {
            return NextResponse.json(
                { error: 'Bucket name is required' },
                { status: 400 }
            );
        }

        if (action === 'delete') {
            if (objectNames && Array.isArray(objectNames)) {
                await deleteObjects(bucket, objectNames);
                return NextResponse.json({ success: true, deleted: objectNames.length });
            } else if (objectName) {
                await deleteObject(bucket, objectName);
                return NextResponse.json({ success: true, deleted: 1 });
            } else {
                return NextResponse.json(
                    { error: 'Object name(s) required for delete' },
                    { status: 400 }
                );
            }
        }

        if (action === 'download') {
            if (!objectName) {
                return NextResponse.json(
                    { error: 'Object name required for download' },
                    { status: 400 }
                );
            }
            const url = await getPresignedDownloadUrl(bucket, objectName);
            return NextResponse.json({ url });
        }

        return NextResponse.json(
            { error: 'Invalid action. Use "delete" or "download"' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Objects action error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to perform action' },
            { status: 500 }
        );
    }
}
