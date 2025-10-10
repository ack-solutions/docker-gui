import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async (_request, _context, _user) => {
  try {
    const volumes = await dockerService.listVolumes();
    return NextResponse.json(volumes);
  } catch (error) {
    console.error("Failed to fetch volumes", error);
    return NextResponse.json({ message: "Unable to retrieve volumes." }, { status: 502 });
  }
}, { permission: "volumes:view" });
