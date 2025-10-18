import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import {
  deleteNginxSite,
  fetchNginxSite,
  updateNginxSite
} from "@/server/nginx/nginx-site-service";

interface RouteContext {
  params: {
    siteId: string;
  };
}

export const runtime = "nodejs";

export const GET = withAuth(
  async (_request: Request, context: RouteContext) => {
    const site = await fetchNginxSite(context.params.siteId);
    if (!site) {
      return NextResponse.json({ message: "Site not found" }, { status: 404 });
    }
    return NextResponse.json(site);
  },
  {
    permission: "nginx:view"
  }
);

export const PUT = withAuth(
  async (request: Request, context: RouteContext) => {
    try {
      const payload = await request.json();
      const site = await updateNginxSite(context.params.siteId, payload);
      return NextResponse.json(site);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update nginx site";
      const status = message === "Nginx site not found" ? 404 : 400;
      return NextResponse.json({ message }, { status });
    }
  },
  {
    permission: "nginx:manage"
  }
);

export const DELETE = withAuth(
  async (_request: Request, context: RouteContext) => {
    await deleteNginxSite(context.params.siteId);
    return new NextResponse(null, { status: 204 });
  },
  {
    permission: "nginx:manage"
  }
);
