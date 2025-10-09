import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";

export const runtime = "nodejs";

export const GET = withAuth(async (_request, { params }, _user) => {
  const containerId = params?.id;

  if (!containerId) {
    return NextResponse.json({ message: "Container id is required." }, { status: 400 });
  }

  try {
    const inspect = await dockerService.inspectContainer(containerId);
    return NextResponse.json(inspect);
  } catch (error) {
    console.error(`Failed to inspect container ${containerId}`, error);
    const status = typeof error === "object" && error && "statusCode" in error
      ? Number((error as any).statusCode) || 500
      : 500;
    const message = error instanceof Error && error.message
      ? error.message
      : "Unable to fetch container details.";

    return NextResponse.json({ message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}, { permission: "containers:view" });
