import { NextRequest, NextResponse } from 'next/server';
import { mailserverAdminService } from '@/server/email/mailserver-admin.service';

// GET /api/email/admin/mailboxes?domain= - List all mailboxes (optionally filtered by domain)
// POST /api/email/admin/mailboxes - Create a new mailbox
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const domain = searchParams.get('domain') || undefined;

        const mailboxes = await mailserverAdminService.listMailboxes(domain);

        return NextResponse.json(mailboxes);
    } catch (error: any) {
        console.error('Failed to list mailboxes:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password, quotaBytes = 1024 * 1024 * 1024, enabled = true } = body; // Default 1GB

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        // Extract domain from email
        const [, domain] = email.split('@');
        if (!domain) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        const mailbox = await mailserverAdminService.createMailbox({
            email,
            domain,
            password,
            quotaBytes,
            enabled,
        });

        return NextResponse.json(mailbox, { status: 201 });
    } catch (error: any) {
        console.error('Failed to create mailbox:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
