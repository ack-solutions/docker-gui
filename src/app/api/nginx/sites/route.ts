import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(
  async () =>
    NextResponse.json(
      { message: "Nginx site catalog API is not connected to a live data source." },
      { status: 501 }
    ),
  {
    permission: "nginx:view"
  }
);
