import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const containerId = params?.id;

  if (!containerId) {
    return NextResponse.json({ message: "Container id is required." }, { status: 400 });
  }

  try {
    await dockerService.startContainer(containerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Failed to start container ${containerId}`, error);
    return NextResponse.json({ message: "Unable to start container." }, { status: 500 });
  }
}

