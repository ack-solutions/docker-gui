import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const DELETE = withAuth(async (request: Request, { params }, _user) => {
  const volumeName = params?.name;

  if (!volumeName) {
    return NextResponse.json({ message: "Volume name is required." }, { status: 400 });
  }

  try {
    await dockerService.removeVolume(volumeName);
    return NextResponse.json({ message: "Volume deleted successfully." });
  } catch (error) {
    console.error(`Failed to delete volume ${volumeName}`, error);
    const message = error instanceof Error ? error.message : "Unable to delete volume.";
    return NextResponse.json({ message }, { status: 500 });
  }
}, { permission: "volumes:manage" });

