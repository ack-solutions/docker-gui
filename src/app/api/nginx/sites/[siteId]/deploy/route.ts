import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { applyNginxSite } from "@/server/nginx/nginx-site-service";

interface RouteContext {
  params: {
    siteId: string;
  };
}

export const runtime = "nodejs";

export const POST = withAuth(
  async (_request: Request, context: RouteContext) => {
    try {
      const site = await applyNginxSite(context.params.siteId);
      return NextResponse.json(site);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to apply nginx site";
      const status = message === "Nginx site not found" ? 404 : 500;
      return NextResponse.json({ message }, { status });
    }
  },
  {
    permission: "nginx:manage"
  }
);
