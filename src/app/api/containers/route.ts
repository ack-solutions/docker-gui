import { NextResponse } from "next/server";
import { listContainers } from "@/server/docker/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const containers = await listContainers();
    return NextResponse.json(containers);
  } catch (error) {
    console.error("Failed to fetch containers", error);
    return NextResponse.json(
      { message: "Unable to communicate with Docker daemon." },
      { status: 502 }
    );
  }
}
