"use server";

import { NextResponse } from "next/server";
import { setupService } from "@/server/setup/setup-service";

export async function POST(request: Request) {
  try {
    const headers = request.headers;
    const setupSecret = headers.get("x-setup-secret");
    
    const payload = await request.json().catch(() => null);
    
    if (!payload) {
      return NextResponse.json(
        { message: "Invalid request body." },
        { status: 400 }
      );
    }

    // Support both header and body secret for flexibility
    const secret = setupSecret || payload.secret;
    
    if (!secret) {
      return NextResponse.json(
        { message: "Setup secret is required (via x-setup-secret header or secret field)." },
        { status: 400 }
      );
    }

    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const name = typeof payload.name === "string" ? payload.name : undefined;

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 }
      );
    }

    await setupService.bootstrapInitialAdmin({
      secret,
      email,
      password,
      name
    });

    return NextResponse.json(
      { message: "Administrator created successfully." },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Failed to bootstrap admin", error);
    const message = error?.message || "Unable to bootstrap administrator.";
    return NextResponse.json(
      { message },
      { status: error?.message?.includes("already exists") ? 409 : 400 }
    );
  }
}

