import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const POST = withAuth(async (request, _context, _user) => {
  try {
    const body = await request.json().catch(() => ({}));
    const networkIds = Array.isArray(body.networkIds) ? body.networkIds : undefined;
    
    // For now, we'll just remove specific networks
    // Docker doesn't have a built-in prune for networks, so we'll handle it manually
    if (networkIds && networkIds.length > 0) {
      let removedCount = 0;
      for (const networkId of networkIds) {
        try {
          await dockerService.removeNetwork(networkId);
          removedCount++;
        } catch (error) {
          console.error(`Failed to remove network ${networkId}:`, error);
        }
      }
      return NextResponse.json({
        removedCount,
        reclaimedSpace: 0 // Networks don't have size
      });
    }

    return NextResponse.json({ message: "No networks specified." }, { status: 400 });
  } catch (error) {
    console.error("Failed to prune networks", error);
    return NextResponse.json({ message: "Unable to prune networks." }, { status: 500 });
  }
}, { permission: "networks:manage" });

