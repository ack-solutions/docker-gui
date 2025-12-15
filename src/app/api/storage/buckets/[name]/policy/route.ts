/**
 * Bucket Policy API
 * GET /api/storage/buckets/[name]/policy - Get bucket policy
 * PUT /api/storage/buckets/[name]/policy - Set bucket policy
 * DELETE /api/storage/buckets/[name]/policy - Remove bucket policy
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getBucketPolicy,
    setBucketPolicy,
    deleteBucketPolicy,
    generateBucketPolicy,
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

        const policy = await getBucketPolicy(params.name);

        return NextResponse.json({ policy });
    } catch (error) {
        console.error('Get bucket policy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to get bucket policy' },
            { status: 500 }
        );
    }
}

export async function PUT(
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

        const body = await request.json();
        const { policy, template } = body;

        let policyToSet = policy;

        // If template is provided, generate policy from template
        if (template && ['readonly', 'readwrite', 'admin'].includes(template)) {
            policyToSet = generateBucketPolicy(params.name, template as any);
        }

        if (!policyToSet) {
            return NextResponse.json(
                { error: 'Policy or template is required' },
                { status: 400 }
            );
        }

        // Validate JSON
        try {
            JSON.parse(policyToSet);
        } catch {
            return NextResponse.json(
                { error: 'Invalid JSON policy' },
                { status: 400 }
            );
        }

        await setBucketPolicy(params.name, policyToSet);

        return NextResponse.json({ success: true, policy: policyToSet });
    } catch (error) {
        console.error('Set bucket policy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to set bucket policy' },
            { status: 500 }
        );
    }
}

export async function DELETE(
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

        await deleteBucketPolicy(params.name);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete bucket policy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete bucket policy' },
            { status: 500 }
        );
    }
}
