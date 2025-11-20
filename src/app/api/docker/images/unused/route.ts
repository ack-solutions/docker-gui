import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async (_request, _context, _user) => {
  try {
    const unusedImages = await dockerService.getUnusedImages();
    return NextResponse.json(unusedImages);
  } catch (error) {
    console.error("Failed to get unused images", error);
    return NextResponse.json({ message: "Unable to retrieve unused images." }, { status: 500 });
  }
}, { permission: "images:view" });

