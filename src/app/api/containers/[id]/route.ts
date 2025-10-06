import { NextResponse } from "next/server";
import { removeContainer } from "@/server/docker/service";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const containerId = params?.id;

  if (!containerId) {
    return NextResponse.json({ message: "Container id is required." }, { status: 400 });
  }

  try {
    await removeContainer(containerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Failed to remove container ${containerId}`, error);
    return NextResponse.json({ message: "Unable to remove container." }, { status: 500 });
  }
}
