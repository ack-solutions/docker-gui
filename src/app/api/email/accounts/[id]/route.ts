import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { EmailService } from "@/server/email/email.service";

export const runtime = "nodejs";

export const DELETE = withAuth(
    async (req, { params, user }) => {
        const { id } = params as { id: string };

        try {
            await EmailService.deleteAccount(user.id, id);
            return NextResponse.json({ message: "Account deleted" });
        } catch (error) {
            console.error("Failed to delete email account:", error);
            return NextResponse.json(
                { message: "Failed to delete email account" },
                { status: 500 }
            );
        }
    },
    {
        permission: "email:view",
    }
);

export const PATCH = withAuth(
    async (request: Request, { params, user }: { params: { id: string }, user: any }) => {
        try {
            const body = await request.json();
            const account = await EmailService.updateAccount(user.id, params.id, body);
            return NextResponse.json(account);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update account";
            return NextResponse.json({ message }, { status: 400 });
        }
    },
    {
        permission: "email:manage"
    }
);
