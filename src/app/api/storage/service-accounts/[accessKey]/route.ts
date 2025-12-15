/**
 * Service Account Details API
 * GET /api/storage/service-accounts/[accessKey] - Get service account details
 * DELETE /api/storage/service-accounts/[accessKey] - Delete service account
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getServiceAccountInfo,
    deleteServiceAccount,
    isMinioEnabled,
} from '@/server/storage/minio.service';

export async function GET(
    request: NextRequest,
    { params }: { params: { accessKey: string } }
) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const info = await getServiceAccountInfo(params.accessKey);

        if (!info) {
            return NextResponse.json(
                { error: 'Service account not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(info);
    } catch (error) {
        console.error('Get service account error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to get service account' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { accessKey: string } }
) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        await deleteServiceAccount(params.accessKey);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete service account error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete service account' },
            { status: 500 }
        );
    }
}
