import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const POST = withAuth(async (request: Request, _context, _user) => {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "Image name is required" },
        { status: 400 }
      );
    }

    await dockerService.pullImage(image);

    return NextResponse.json({ success: true, image });
  } catch (error: any) {
    console.error("Failed to pull image:", error);
    return NextResponse.json(
      { error: error.message || "Failed to pull image" },
      { status: 500 }
    );
  }
}, { permission: "images:manage" });
