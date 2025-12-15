/**
 * Move/Copy Objects API
 * POST /api/storage/move - Move or copy objects to a new location
 */

import { NextRequest, NextResponse } from 'next/server';
import { moveObject, copyObject, moveObjects, isMinioEnabled } from '@/server/storage/minio.service';

export async function POST(request: NextRequest) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const body = await request.json();
        const { action, bucket, sourcePath, destinationPath, sourcePaths, destinationPrefix } = body;

        if (!bucket) {
            return NextResponse.json(
                { error: 'Bucket is required' },
                { status: 400 }
            );
        }

        // Handle single object move/copy
        if (sourcePath && destinationPath) {
            if (action === 'move') {
                await moveObject(bucket, sourcePath, destinationPath);
                return NextResponse.json({
                    success: true,
                    message: 'Object moved successfully',
                });
            } else if (action === 'copy') {
                await copyObject(bucket, sourcePath, destinationPath);
                return NextResponse.json({
                    success: true,
                    message: 'Object copied successfully',
                });
            }
        }

        // Handle multiple objects move
        if (sourcePaths && Array.isArray(sourcePaths) && destinationPrefix) {
            if (action === 'move') {
                await moveObjects(bucket, sourcePaths, destinationPrefix);
                return NextResponse.json({
                    success: true,
                    message: `Successfully moved ${sourcePaths.length} object(s)`,
                });
            }
        }

        return NextResponse.json(
            { error: 'Invalid parameters or action' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Move/copy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to move/copy object(s)' },
            { status: 500 }
        );
    }
}
