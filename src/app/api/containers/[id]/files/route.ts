import { NextRequest, NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const containerId = params?.id;

  if (!containerId) {
    return NextResponse.json({ message: "Container id is required." }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const pathParam = url.searchParams.get("path") ?? "/";
    const files = await dockerService.listContainerFiles(containerId, pathParam || "/");
    return NextResponse.json(files);
  } catch (error) {
    console.error(`Failed to fetch files for container ${containerId}`, error);
    return NextResponse.json({ message: "Unable to retrieve files." }, { status: 500 });
  }
}
