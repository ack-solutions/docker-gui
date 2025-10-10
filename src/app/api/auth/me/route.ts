import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireUser(request);
  return NextResponse.json({ user });
}
