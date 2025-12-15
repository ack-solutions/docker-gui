import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import {
  collectSystemMetrics,
} from "@/server/system/metrics-service";
import { MetricsLoggingService } from "@/server/system/metrics-logging-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export const GET = withAuth(async () => {
  try {
    const metrics = await collectSystemMetrics();
    
    // Queue metrics for logging (non-blocking, silent on error)
    MetricsLoggingService.getInstance().queueMetrics(metrics).catch(() => {
      // Silently handle errors to reduce overhead
    });
    
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("[system] Failed to collect system metrics", error);
    return NextResponse.json(
      { message: "Unable to collect system metrics at this time." },
      { status: 500 }
    );
  }
}, { permission: "dashboard:view" });
