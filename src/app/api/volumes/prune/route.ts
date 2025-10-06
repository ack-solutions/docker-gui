import { NextResponse } from "next/server";
import { pruneDanglingVolumes } from "@/server/docker/service";

export const runtime = "nodejs";

export async function POST() {
  try {
    await pruneDanglingVolumes();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to prune volumes", error);
    return NextResponse.json({ message: "Unable to prune volumes." }, { status: 500 });
  }
}
