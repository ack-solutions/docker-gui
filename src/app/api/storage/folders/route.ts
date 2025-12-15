/**
 * Folders API
 * POST /api/storage/folders - Create a folder in a bucket
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFolder, isMinioEnabled } from '@/server/storage/minio.service';

export async function POST(request: NextRequest) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const body = await request.json();
        const { bucket, path } = body;

        if (!bucket) {
            return NextResponse.json(
                { error: 'Bucket name is required' },
                { status: 400 }
            );
        }

        if (!path) {
            return NextResponse.json(
                { error: 'Folder path is required' },
                { status: 400 }
            );
        }

        // Validate folder name
        const folderName = path.split('/').filter(Boolean).pop();
        if (!folderName || /[<>:"|?*\\]/.test(folderName)) {
            return NextResponse.json(
                { error: 'Invalid folder name' },
                { status: 400 }
            );
        }

        await createFolder(bucket, path);

        return NextResponse.json({
            success: true,
            path: path.endsWith('/') ? path : path + '/',
        });
    } catch (error) {
        console.error('Create folder error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create folder' },
            { status: 500 }
        );
    }
}
