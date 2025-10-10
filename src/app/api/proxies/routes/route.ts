import { NextResponse } from "next/server";
import { mockProxyRoutes } from "@/lib/mocks/server";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async () => NextResponse.json(mockProxyRoutes), {
  permission: "proxies:view"
});
