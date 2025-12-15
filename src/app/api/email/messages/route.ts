import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { EmailService } from "@/server/email/email.service";

export const runtime = "nodejs";

export const GET = withAuth(
    async (req, { user }) => {
        const { searchParams } = new URL(req.url);
        const folderId = searchParams.get("folderId");
        const page = Number(searchParams.get("page")) || 1;
        const limit = Number(searchParams.get("limit")) || 20;

        if (!folderId) {
            return NextResponse.json({ message: "Folder ID is required" }, { status: 400 });
        }

        try {
            const result = await EmailService.getEmails(user.id, folderId, page, limit);
            return NextResponse.json(result);
        } catch (error) {
            console.error("Failed to fetch emails:", error);
            return NextResponse.json(
                { message: error instanceof Error ? error.message : "Failed to fetch emails" },
                { status: 500 }
            );
        }
    },
    {
        permission: "email:view",
    }
);
