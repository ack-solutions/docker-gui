import { NextResponse } from "next/server";
import { AuthError, authService } from "@/server/auth/auth-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body as { email?: string; password?: string };

    const result = authService.login({
      email: email ?? "",
      password: password ?? ""
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }

    console.error("Failed to authenticate user", error);
    return NextResponse.json({ message: "Unable to authenticate user." }, { status: 500 });
  }
}
