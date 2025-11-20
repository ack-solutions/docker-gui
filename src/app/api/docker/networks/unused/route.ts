import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async (_request, _context, _user) => {
  try {
    const unusedNetworks = await dockerService.getUnusedNetworks();
    return NextResponse.json(unusedNetworks);
  } catch (error) {
    console.error("Failed to get unused networks", error);
    return NextResponse.json({ message: "Unable to retrieve unused networks." }, { status: 500 });
  }
}, { permission: "networks:view" });

