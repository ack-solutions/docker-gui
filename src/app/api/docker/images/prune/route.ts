import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const POST = withAuth(async (request, _context, _user) => {
  try {
    const body = await request.json().catch(() => ({}));
    const imageIds = Array.isArray(body.imageIds) ? body.imageIds : undefined;
    
    const summary = await dockerService.pruneUnusedImages(imageIds);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to prune images", error);
    return NextResponse.json({ message: "Unable to prune images." }, { status: 500 });
  }
}, { permission: "images:manage" });
