import { NextResponse } from "next/server";
import { EmailService } from "@/server/email/email.service";
import { prisma } from "@/server/database/client";

export const runtime = "nodejs";

// This endpoint can be called by a cron job (e.g., Vercel Cron, GitHub Actions, or external service)
// For local dev, you could use node-cron or just call this manually
export async function GET(req: Request) {
    // Verify this is an internal/cron request
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "dev-secret-change-in-production";

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        // Get all email accounts
        const accounts = await prisma.emailAccount.findMany({
            select: { id: true, userId: true },
        });

        const results = [];
        for (const account of accounts) {
            try {
                await EmailService.syncAccount(account.userId, account.id);
                results.push({ accountId: account.id, status: "success" });
            } catch (error) {
                console.error(`Failed to sync account ${account.id}:`, error);
                results.push({ accountId: account.id, status: "error" });
            }
        }

        return NextResponse.json({
            message: "Background sync completed",
            results,
        });
    } catch (error) {
        console.error("Background sync failed:", error);
        return NextResponse.json(
            { message: "Background sync failed" },
            { status: 500 }
        );
    }
}
