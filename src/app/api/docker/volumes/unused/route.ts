import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async (_request, _context, _user) => {
  try {
    const unusedVolumes = await dockerService.getUnusedVolumes();
    return NextResponse.json(unusedVolumes);
  } catch (error) {
    console.error("Failed to get unused volumes", error);
    return NextResponse.json({ message: "Unable to retrieve unused volumes." }, { status: 500 });
  }
}, { permission: "volumes:view" });

