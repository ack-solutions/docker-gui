import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { EmailService } from "@/server/email/email.service";
import { createEmailAccountSchema } from "@/server/email/email.dto";
import * as yup from "yup";

export const runtime = "nodejs";

export const GET = withAuth(
  async (req, { user }) => {
    try {
      const accounts = await EmailService.getAccounts(user.id);
      return NextResponse.json(accounts);
    } catch (error) {
      console.error("Failed to fetch email accounts:", error);
      return NextResponse.json(
        { message: "Failed to fetch email accounts" },
        { status: 500 }
      );
    }
  },
  {
    permission: "email:view",
  }
);

export const POST = withAuth(
  async (req, { user }) => {
    try {
      const body = await req.json();
      const data = await createEmailAccountSchema.validate(body);

      const account = await EmailService.createAccount(user.id, data);

      return NextResponse.json(account);
    } catch (error) {
      console.error("Failed to create email account:", error);
      if (error instanceof yup.ValidationError) {
        return NextResponse.json(
          { message: "Invalid input", errors: error.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { message: "Failed to create email account" },
        { status: 400 }
      );
    }
  },
  {
    permission: "email:view",
  }
);
