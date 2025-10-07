import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const containerId = params?.id;

  if (!containerId) {
    return NextResponse.json({ message: "Container id is required." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const command = body?.command ?? body?.Cmd ?? body?.cmd;

  if (!Array.isArray(command) || command.some((part) => typeof part !== "string")) {
    return NextResponse.json({ message: "Command must be an array of strings." }, { status: 400 });
  }

  try {
    const output = await dockerService.execInContainer(containerId, command);
    return NextResponse.json({ output });
  } catch (error) {
    console.error(`Failed to execute command in container ${containerId}`, error);
    return NextResponse.json({ message: "Unable to execute command." }, { status: 500 });
  }
}
