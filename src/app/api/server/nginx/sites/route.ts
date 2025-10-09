import { NextResponse } from "next/server";
import { mockNginxSites } from "@/lib/mocks/server";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async () => NextResponse.json(mockNginxSites), {
  permission: "nginx:view"
});
