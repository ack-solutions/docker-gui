import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async (_request, _context, _user) => {
  try {
    const stoppedContainers = await dockerService.getStoppedContainers();
    return NextResponse.json(stoppedContainers);
  } catch (error) {
    console.error("Failed to get stopped containers", error);
    return NextResponse.json({ message: "Unable to retrieve stopped containers." }, { status: 500 });
  }
}, { permission: "containers:view" });

