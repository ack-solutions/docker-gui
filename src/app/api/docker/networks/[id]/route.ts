import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const DELETE = withAuth(async (request: Request, { params }, _user) => {
  const networkId = params?.id;

  if (!networkId) {
    return NextResponse.json({ message: "Network ID is required." }, { status: 400 });
  }

  try {
    await dockerService.removeNetwork(networkId);
    return NextResponse.json({ message: "Network deleted successfully." });
  } catch (error) {
    console.error(`Failed to delete network ${networkId}`, error);
    const message = error instanceof Error ? error.message : "Unable to delete network.";
    return NextResponse.json({ message }, { status: 500 });
  }
}, { permission: "networks:manage" });

