import { NextRequest, NextResponse } from "next/server";
import { AuthError, authService } from "@/server/auth/auth-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    return NextResponse.json({ message: "Authorization token is required." }, { status: 401 });
  }

  try {
    const user = authService.verify(token);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }

    console.error("Failed to verify authentication token", error);
    return NextResponse.json({ message: "Unable to verify token." }, { status: 500 });
  }
}
