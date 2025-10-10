import { NextResponse } from "next/server";
import { mockDomains } from "@/lib/mocks/server";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async () => NextResponse.json(mockDomains), {
  permission: "domains:view"
});
