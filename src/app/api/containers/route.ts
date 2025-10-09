import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";
import { withAuth } from "@/server/auth/authorization";
import type { CreateContainerRequest } from "@/types/docker";

export const runtime = "nodejs";

export const GET = withAuth(async (_request, _context, _user) => {
  try {
    const containers = await dockerService.listContainers();
    return NextResponse.json(containers);
  } catch (error) {
    console.error("Failed to fetch containers", error);
    return NextResponse.json(
      { message: "Unable to communicate with Docker daemon." },
      { status: 502 }
    );
  }
}, { permission: "containers:view" });

export const POST = withAuth(async (request, _context, _user) => {
  let payload: CreateContainerRequest;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse container creation payload", error);
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  if (!payload?.image || typeof payload.image !== "string" || payload.image.trim().length === 0) {
    return NextResponse.json({ message: "Image is required to create a container." }, { status: 400 });
  }

  try {
    const container = await dockerService.createContainer(payload);
    return NextResponse.json(container, { status: 201 });
  } catch (error) {
    console.error("Failed to create container", error);
    const status = typeof error === "object" && error && "statusCode" in error
      ? Number((error as any).statusCode) || 500
      : 500;
    const message = error instanceof Error && error.message
      ? error.message
      : "Unable to create container. Check Docker daemon and request parameters.";

    return NextResponse.json(
      { message },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}, { permission: "containers:manage" });
