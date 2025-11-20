import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const POST = withAuth(async (request, _context, _user) => {
  try {
    const body = await request.json().catch(() => ({}));
    const volumeNames = Array.isArray(body.volumeNames) ? body.volumeNames : undefined;
    
    const summary = await dockerService.pruneDanglingVolumes(volumeNames);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to prune volumes", error);
    return NextResponse.json({ message: "Unable to prune volumes." }, { status: 500 });
  }
}, { permission: "volumes:manage" });
