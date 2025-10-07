import { NextResponse } from "next/server";
import { AuthError, authService } from "@/server/auth/auth-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password, name } = body as { email?: string; password?: string; name?: string };

    const result = authService.register({
      email: email ?? "",
      password: password ?? "",
      name
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }

    console.error("Failed to register user", error);
    return NextResponse.json({ message: "Unable to register user." }, { status: 500 });
  }
}
