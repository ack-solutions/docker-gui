import { NextRequest, NextResponse } from 'next/server';
import { mailserverAdminService } from '@/server/email/mailserver-admin.service';

// GET /api/email/admin/domains - List all domains
// POST /api/email/admin/domains - Create a new domain
export async function GET(req: NextRequest) {
    try {
        const domains = await mailserverAdminService.listDomains();
        return NextResponse.json(domains);
    } catch (error: any) {
        console.error('Failed to list domains:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, enabled = true, maxQuotaBytes, maxAliases } = body;

        if (!name) {
            return NextResponse.json({ error: 'Domain name is required' }, { status: 400 });
        }

        const domain = await mailserverAdminService.createDomain({
            name,
            enabled,
            maxQuotaBytes,
            maxAliases,
        });

        return NextResponse.json(domain, { status: 201 });
    } catch (error: any) {
        console.error('Failed to create domain:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
