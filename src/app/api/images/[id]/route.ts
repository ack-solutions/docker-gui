import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const DELETE = withAuth(async (_request: Request, { params }, _user) => {
  if (!params?.id) {
    return NextResponse.json({ message: "Image id is required." }, { status: 400 });
  }

  try {
    await dockerService.removeImage(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Failed to remove image ${params.id}`, error);
    return NextResponse.json({ message: "Unable to remove image." }, { status: 500 });
  }
}, { permission: "images:manage" });
