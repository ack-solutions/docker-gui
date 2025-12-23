/**
 * Bulk Operations API
 * POST /api/storage/bulk - Perform bulk operations on multiple objects
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteObjects, isMinioEnabled } from '@/server/storage/minio.service';

export async function POST(request: NextRequest) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const body = await request.json();
        const { action, bucket, objectNames } = body;

        if (!bucket || !objectNames || !Array.isArray(objectNames)) {
            return NextResponse.json(
                { error: 'Bucket and objectNames array are required' },
                { status: 400 }
            );
        }

        if (action === 'delete') {
            await deleteObjects(bucket, objectNames);
            return NextResponse.json({
                success: true,
                deleted: objectNames.length,
                message: `Successfully deleted ${objectNames.length} object(s)`,
            });
        }

        if (action === 'download') {
            // For bulk download, we'll return URLs for each file
            // The client can download them individually or we could create a zip
            // For now, return error as zip creation requires streaming setup
            return NextResponse.json(
                { error: 'Bulk download not yet implemented. Please download files individually.' },
                { status: 501 }
            );
        }

        return NextResponse.json(
            { error: 'Invalid action. Use "delete" or "download"' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Bulk operation error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to perform bulk operation' },
            { status: 500 }
        );
    }
}
