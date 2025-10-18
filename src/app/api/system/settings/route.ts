import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { SettingsService } from "@/server/system/settings-service";

export const runtime = "nodejs";

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get("key");

    const settingsService = SettingsService.getInstance();

    if (key) {
      const setting = await settingsService.get(key);
      if (!setting) {
        return NextResponse.json(
          { message: "Setting not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(setting);
    }

    const settings = await settingsService.getAll();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[system] Failed to fetch settings", error);
    return NextResponse.json(
      { message: "Unable to fetch settings at this time." },
      { status: 500 }
    );
  }
}, { permission: "settings:view" });

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { key, value, description } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { message: "Key and value are required" },
        { status: 400 }
      );
    }

    const settingsService = SettingsService.getInstance();
    const setting = await settingsService.set(key, value, description);

    return NextResponse.json(setting);
  } catch (error) {
    console.error("[system] Failed to save setting", error);
    return NextResponse.json(
      { message: "Unable to save setting at this time." },
      { status: 500 }
    );
  }
}, { permission: "settings:edit" });

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { message: "Key is required" },
        { status: 400 }
      );
    }

    const settingsService = SettingsService.getInstance();
    const deleted = await settingsService.delete(key);

    if (!deleted) {
      return NextResponse.json(
        { message: "Setting not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[system] Failed to delete setting", error);
    return NextResponse.json(
      { message: "Unable to delete setting at this time." },
      { status: 500 }
    );
  }
}, { permission: "settings:edit" });

