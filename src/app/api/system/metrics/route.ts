import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import {
  collectSystemMetrics,
  generateMockSystemMetrics
} from "@/server/system/metrics-service";
import { MetricsLoggingService } from "@/server/system/metrics-logging-service";

export const runtime = "nodejs";

const shouldUseMockData = (process.env.SYSTEM_METRICS_PROVIDER ?? "").toLowerCase() === "mock";

export const GET = withAuth(async () => {
  try {
    const metrics = shouldUseMockData ? generateMockSystemMetrics() : await collectSystemMetrics();
    
    // Queue metrics for logging (non-blocking)
    MetricsLoggingService.getInstance().queueMetrics(metrics).catch((error) => {
      console.error("[system] Failed to queue metrics for logging", error);
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
