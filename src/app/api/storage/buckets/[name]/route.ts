/**
 * Single Bucket API
 * GET /api/storage/buckets/[name] - Get bucket details
 * DELETE /api/storage/buckets/[name] - Delete a bucket
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBucketDetails, deleteBucket, isMinioEnabled } from '@/server/storage/minio.service';

interface RouteParams {
    params: Promise<{ name: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const { name } = await params;
        const bucket = await getBucketDetails(name);

        if (!bucket) {
            return NextResponse.json(
                { error: `Bucket '${name}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json(bucket);
    } catch (error) {
        console.error('Get bucket error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to get bucket details' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const { name } = await params;
        await deleteBucket(name);

        return NextResponse.json({ success: true, message: `Bucket '${name}' deleted` });
    } catch (error) {
        console.error('Delete bucket error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete bucket' },
            { status: 500 }
        );
    }
}
