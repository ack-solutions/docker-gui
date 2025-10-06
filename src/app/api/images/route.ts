import { NextResponse } from "next/server";
import { listImages } from "@/server/docker/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const images = await listImages();
    return NextResponse.json(images);
  } catch (error) {
    console.error("Failed to fetch images", error);
    return NextResponse.json({ message: "Unable to retrieve images." }, { status: 502 });
  }
}
