import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const networks = await dockerService.listNetworks();
    return NextResponse.json(networks);
  } catch (error) {
    console.error("Failed to fetch networks", error);
    return NextResponse.json({ message: "Unable to retrieve networks." }, { status: 502 });
  }
}
