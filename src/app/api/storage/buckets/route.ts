/**
 * Buckets API
 * GET /api/storage/buckets - List all buckets
 * POST /api/storage/buckets - Create a new bucket
 */

import { NextRequest, NextResponse } from 'next/server';
import { listBuckets, createBucket, isMinioEnabled } from '@/server/storage/minio.service';

export async function GET() {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const buckets = await listBuckets();
        return NextResponse.json(buckets);
    } catch (error) {
        console.error('List buckets error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to list buckets' },
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
        const { name, region } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Bucket name is required' },
                { status: 400 }
            );
        }

        const bucket = await createBucket({ name, region });
        return NextResponse.json(bucket, { status: 201 });
    } catch (error) {
        console.error('Create bucket error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create bucket' },
            { status: 500 }
        );
    }
}
