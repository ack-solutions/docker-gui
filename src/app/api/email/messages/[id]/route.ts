import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { EmailService } from "@/server/email/email.service";

export const runtime = "nodejs";

export const GET = withAuth(
    async (req, { params, user }: { params: { id: string }, user: any }) => {
        try {
            const email = await EmailService.getEmail(user.id, params.id);
            return NextResponse.json(email);
        } catch (error) {
            console.error("Failed to fetch email:", error);
            return NextResponse.json(
                { message: error instanceof Error ? error.message : "Failed to fetch email" },
                { status: 500 }
            );
        }
    },
    {
        permission: "email:view",
    }
);
