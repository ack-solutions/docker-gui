import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async (_request, _context, _user) => {
  try {
    const images = await dockerService.listImages();
    return NextResponse.json(images);
  } catch (error) {
    console.error("Failed to fetch images", error);
    return NextResponse.json({ message: "Unable to retrieve images." }, { status: 502 });
  }
}, { permission: "images:view" });
