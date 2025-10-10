import { NextResponse } from "next/server";

export async function POST() {
  // Client-side logout (token removal happens on client)
  // This endpoint exists for consistency but doesn't need to do anything
  // as we're using client-side JWT tokens
  return NextResponse.json({ success: true });
}
