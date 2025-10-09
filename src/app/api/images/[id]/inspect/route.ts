import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async (_request: Request, { params }, _user) => {
  const imageId = params?.id;

  if (!imageId) {
    return NextResponse.json({ message: "Image id is required." }, { status: 400 });
  }

  try {
    const inspect = await dockerService.inspectImage(imageId);
    return NextResponse.json(inspect);
  } catch (error) {
    console.error(`Failed to inspect image ${imageId}`, error);
    const status = typeof error === "object" && error && "statusCode" in error
      ? Number((error as any).statusCode) || 500
      : 500;
    const message = error instanceof Error && error.message
      ? error.message
      : "Unable to fetch image details.";

    return NextResponse.json({ message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}, { permission: "images:view" });
