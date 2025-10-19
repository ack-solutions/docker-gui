import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import {
  createNginxSite,
  listNginxSites
} from "@/server/nginx/nginx-site-service";
import { config } from "@/server/config";

export const runtime = "nodejs";

export const GET = withAuth(
  async () => {
    // Check if Nginx feature is enabled
    if (!config.features.nginxManagement) {
      return NextResponse.json({ 
        sites: [],
        disabled: true,
        message: "Nginx management is disabled in configuration" 
      });
    }

    try {
      const sites = await listNginxSites();
      return NextResponse.json({ sites, disabled: false });
    } catch (error) {
      console.error("Failed to list nginx sites", error);
      return NextResponse.json(
        { 
          sites: [],
          error: error instanceof Error ? error.message : "Failed to load Nginx sites",
          disabled: false
        }
      );
    }
  },
  {
    permission: "nginx:view"
  }
);

export const POST = withAuth(
  async (request: Request) => {
    // Check if Nginx feature is enabled
    if (!config.features.nginxManagement) {
      return NextResponse.json(
        { error: "Nginx management is disabled in configuration" },
        { status: 403 }
      );
    }

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
