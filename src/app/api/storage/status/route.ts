/**
 * Storage Status API
 * GET /api/storage/status - Check MinIO connection status and get endpoint info
 */

import { NextResponse } from 'next/server';
import { testConnection, getS3EndpointInfo, isMinioEnabled } from '@/server/storage/minio.service';

export async function GET() {
    try {
        // Check if MinIO is enabled
        if (!isMinioEnabled()) {
            return NextResponse.json({
                enabled: false,
                connected: false,
                message: 'MinIO storage is not enabled in configuration',
            });
        }

        // Test connection
        const status = await testConnection();

        // Get S3 endpoint info for configuration
        const s3Config = getS3EndpointInfo();

        return NextResponse.json({
            enabled: true,
            ...status,
            s3Config,
        });
    } catch (error) {
        console.error('Storage status error:', error);
        return NextResponse.json(
            {
                enabled: false,
                connected: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
