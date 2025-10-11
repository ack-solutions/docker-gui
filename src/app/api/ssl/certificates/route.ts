import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(
  async () =>
    NextResponse.json(
      { message: "SSL certificate inventory API is not connected to a live data source." },
      { status: 501 }
    ),
  {
    permission: "ssl:view"
  }
);
