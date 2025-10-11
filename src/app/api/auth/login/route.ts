import { NextResponse } from "next/server";
import { AuthError, AUTH_COOKIE_NAME, authService } from "@/server/auth/auth-service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body as { email?: string; password?: string };

    const result = await authService.login({
      email: email ?? "",
      password: password ?? ""
    });

    const response = NextResponse.json(result);
    
    // Set cookie with proper options for development and production
    // const cookieSecure = process.env.AUTH_COOKIE_SECURE === "false" || process.env.AUTH_COOKIE_SECURE === "0";
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: result.token,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12 // 12 hours
    });

    console.log(`[auth/login] User logged in: ${result.user.email}, cookie set (secure: ${false})`);
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }

    console.error("Failed to authenticate user", error);
    return NextResponse.json({ message: "Unable to authenticate user." }, { status: 500 });
  }
}
