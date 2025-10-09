import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const POST = withAuth(async (_request, _context, _user) => {
  try {
    const summary = await dockerService.pruneDanglingVolumes();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to prune volumes", error);
    return NextResponse.json({ message: "Unable to prune volumes." }, { status: 500 });
  }
}, { permission: "volumes:manage" });
