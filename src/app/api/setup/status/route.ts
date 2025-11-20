"use server";

import { NextResponse } from "next/server";
import { setupService } from "@/server/setup/setup-service";

export async function GET() {
  try {
    const status = await setupService.getStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error("Failed to get setup status", error);
    return NextResponse.json(
      { message: "Unable to retrieve setup status." },
      { status: 500 }
    );
  }
}

