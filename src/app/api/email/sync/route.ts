import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { EmailService } from "@/server/email/email.service";
import * as yup from "yup";

export const runtime = "nodejs";

const syncSchema = yup.object({
    accountId: yup.string().required("Account ID is required"),
});

export const POST = withAuth(
    async (req, { user }) => {
        try {
            const body = await req.json();
            const { accountId } = await syncSchema.validate(body);

            await EmailService.syncAccount(user.id, accountId);

            return NextResponse.json({ message: "Sync completed" });
        } catch (error) {
            console.error("Failed to sync email account:", error);
            if (error instanceof yup.ValidationError) {
                return NextResponse.json(
                    { message: "Invalid input", errors: error.errors },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { message: "Failed to sync email account" },
                { status: 500 }
            );
        }
    },
    {
        permission: "email:view",
    }
);
