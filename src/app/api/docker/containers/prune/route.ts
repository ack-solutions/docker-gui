import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const POST = withAuth(async (request, _context, _user) => {
  try {
    const body = await request.json().catch(() => ({}));
    const containerIds = Array.isArray(body.containerIds) ? body.containerIds : undefined;
    
    const summary = await dockerService.pruneStoppedContainers(containerIds);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to prune containers", error);
    return NextResponse.json({ message: "Unable to prune containers." }, { status: 500 });
  }
}, { permission: "containers:manage" });
