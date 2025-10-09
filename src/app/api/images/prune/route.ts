import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const POST = withAuth(async (_request, _context, _user) => {
  try {
    const summary = await dockerService.pruneUnusedImages();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to prune images", error);
    return NextResponse.json({ message: "Unable to prune images." }, { status: 500 });
  }
}, { permission: "images:manage" });
