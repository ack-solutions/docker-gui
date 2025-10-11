import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("[auth/me] Failed to get user:", error.message);
    return NextResponse.json(
      { message: error.message || "Unauthorized" },
      { status: error.statusCode || 401 }
    );
  }
}
