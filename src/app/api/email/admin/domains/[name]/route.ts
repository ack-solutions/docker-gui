import { NextRequest, NextResponse } from 'next/server';
import { mailserverAdminService } from '@/server/email/mailserver-admin.service';

type RouteParams = {
    params: { name: string };
};

// GET /api/email/admin/domains/[name] - Get a specific domain
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const domain = await mailserverAdminService.getDomain(params.name);
        if (!domain) {
            return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
        }
        return NextResponse.json(domain);
    } catch (error: any) {
        console.error('Failed to get domain:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH /api/email/admin/domains/[name] - Update a domain
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const body = await req.json();
        const domain = await mailserverAdminService.updateDomain(params.name, body);
        return NextResponse.json(domain);
    } catch (error: any) {
        console.error('Failed to update domain:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/email/admin/domains/[name] - Delete a domain
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        await mailserverAdminService.deleteDomain(params.name);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Failed to delete domain:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
