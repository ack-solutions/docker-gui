import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { EmailService } from "@/server/email/email.service";
import { sendEmailSchema } from "@/server/email/email.dto";
import * as yup from "yup";

export const runtime = "nodejs";

export const POST = withAuth(
    async (req, { user }) => {
        try {
            const body = await req.json();
            const data = await sendEmailSchema.validate(body);

            const result = await EmailService.sendEmail(user.id, data);

            return NextResponse.json({ message: "Email sent", ...result });
        } catch (error) {
            console.error("Failed to send email:", error);
            if (error instanceof yup.ValidationError) {
                return NextResponse.json(
                    { message: "Invalid input", errors: error.errors },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { message: error instanceof Error ? error.message : "Failed to send email" },
                { status: 500 }
            );
        }
    },
    {
        permission: "email:view",
    }
);
