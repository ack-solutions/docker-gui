import { NextResponse } from "next/server";
import { dockerService } from "@/server/docker/service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const summary = await dockerService.pruneUnusedImages();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to prune images", error);
    return NextResponse.json({ message: "Unable to prune images." }, { status: 500 });
  }
}
