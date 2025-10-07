import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
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
}
