import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const volumes = await dockerService.listVolumes();
    return NextResponse.json(volumes);
  } catch (error) {
    console.error("Failed to fetch volumes", error);
    return NextResponse.json({ message: "Unable to retrieve volumes." }, { status: 502 });
  }
}
