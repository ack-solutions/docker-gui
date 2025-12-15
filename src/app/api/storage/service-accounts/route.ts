/**
 * Service Accounts API
 * GET /api/storage/service-accounts - List service accounts
 * POST /api/storage/service-accounts - Create service account
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    listServiceAccounts,
    createServiceAccount,
    generateBucketPolicy,
    isMinioEnabled,
} from '@/server/storage/minio.service';

export async function GET(request: NextRequest) {
    try {
        if (!isMinioEnabled()) {
            return NextResponse.json(
                { error: 'MinIO storage is not enabled' },
                { status: 503 }
            );
        }

        const accounts = await listServiceAccounts();

        return NextResponse.json(accounts);
    } catch (error) {
        console.error('List service accounts error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to list service accounts' },
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
        const { name, policy, bucket, access } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Service account name is required' },
                { status: 400 }
            );
        }

        let policyToUse = policy;

        // Generate policy from template if bucket and access are provided
        if (bucket && access && ['readonly', 'readwrite', 'admin'].includes(access)) {
            policyToUse = generateBucketPolicy(bucket, access as any);
        }

        if (!policyToUse) {
            return NextResponse.json(
                { error: 'Policy is required (or provide bucket and access template)' },
                { status: 400 }
            );
        }

        const result = await createServiceAccount(name, policyToUse);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Create service account error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create service account' },
            { status: 500 }
        );
    }
}
