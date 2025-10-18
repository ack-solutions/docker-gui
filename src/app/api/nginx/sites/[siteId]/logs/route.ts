import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { fetchNginxProvisionLogs } from "@/server/nginx/nginx-site-service";

interface RouteContext {
  params: {
    siteId: string;
  };
}

export const runtime = "nodejs";

export const GET = withAuth(
  async (request: Request, context: RouteContext) => {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const parsedLimit = limit ? Number(limit) : undefined;
    const logs = await fetchNginxProvisionLogs(
      context.params.siteId,
      Number.isFinite(parsedLimit) ? Number(parsedLimit) : 50
    );
    return NextResponse.json(logs);
  },
  {
    permission: "nginx:view"
  }
);
