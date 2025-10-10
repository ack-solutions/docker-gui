import { NextResponse } from "next/server";
import { mockCertificates } from "@/lib/mocks/server";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async () => NextResponse.json(mockCertificates), {
  permission: "ssl:view"
});
