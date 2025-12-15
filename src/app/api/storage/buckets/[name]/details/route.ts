/**
 * Bucket Details API
 * GET /api/storage/buckets/[name]/details - Get comprehensive bucket information
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getBucketDetails,
    getBucketVersioning,
    getBucketTags,
    isMinioEnabled,
} from '@/server/storage/minio.service';

export async function GET(
    request: NextRequest,
    { params }: { params: { name: string } }
) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const bucketName = params.name;

        // Get bucket details
        const details = await getBucketDetails(bucketName);

        if (!details) {
            return NextResponse.json(
                { error: 'Bucket not found' },
                { status: 404 }
            );
        }

        // Get additional information
        const [versioning, tags] = await Promise.all([
            getBucketVersioning(bucketName),
            getBucketTags(bucketName),
        ]);

        return NextResponse.json({
            ...details,
            versioning,
            tags,
        });
    } catch (error) {
        console.error('Get bucket details error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to get bucket details' },
            { status: 500 }
        );
    }
}
