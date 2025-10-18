import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import {
  createNginxSite,
  listNginxSites
} from "@/server/nginx/nginx-site-service";

export const runtime = "nodejs";

export const GET = withAuth(
  async () => {
    const sites = await listNginxSites();
    return NextResponse.json(sites);
  },
  {
    permission: "nginx:view"
  }
);

export const POST = withAuth(
  async (request: Request) => {
    try {
      const payload = await request.json();
      const site = await createNginxSite(payload);
      return NextResponse.json(site, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create nginx site";
      return NextResponse.json({ message }, { status: 400 });
    }
  },
  {
    permission: "nginx:manage"
  }
);
