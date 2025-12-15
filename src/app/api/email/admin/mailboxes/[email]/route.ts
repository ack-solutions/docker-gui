import { NextRequest, NextResponse } from 'next/server';
import { mailserverAdminService } from '@/server/email/mailserver-admin.service';

type RouteParams = {
    params: { email: string };
};

// GET /api/email/admin/mailboxes/[email] - Get a specific mailbox
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const email = decodeURIComponent(params.email);
        const mailbox = await mailserverAdminService.getMailbox(email);

        if (!mailbox) {
            return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
        }

        return NextResponse.json(mailbox);
    } catch (error: any) {
        console.error('Failed to get mailbox:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH /api/email/admin/mailboxes/[email] - Update a mailbox
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const email = decodeURIComponent(params.email);
        const body = await req.json();

        // Handle password update separately if provided
        if (body.password) {
            await mailserverAdminService.setMailboxPassword(email, body.password);
            delete body.password; // Don't pass to update
        }

        const mailbox = await mailserverAdminService.updateMailbox(email, body);
        return NextResponse.json(mailbox);
    } catch (error: any) {
        console.error('Failed to update mailbox:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/email/admin/mailboxes/[email] - Delete a mailbox
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const email = decodeURIComponent(params.email);
        await mailserverAdminService.deleteMailbox(email);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Failed to delete mailbox:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
