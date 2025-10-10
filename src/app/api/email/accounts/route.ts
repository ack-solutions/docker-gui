import { NextResponse } from "next/server";
import { mockEmailAccounts } from "@/lib/mocks/server";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async () => NextResponse.json(mockEmailAccounts), {
  permission: "email:view"
});
