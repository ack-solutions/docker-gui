import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { MetricsLoggingService } from "@/server/system/metrics-logging-service";

export const runtime = "nodejs";

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const type = body.type as "cpu" | "memory" | "disk" | undefined;

    const loggingService = MetricsLoggingService.getInstance();
    const results = await loggingService.cleanupOldLogs(type);

    const totalDeleted = results.cpu + results.memory + results.disk;

    return NextResponse.json({
      success: true,
      deletedCount: totalDeleted,
      details: results,
      message: type
        ? `Cleaned up ${results[type]} old ${type} metrics logs`
        : `Cleaned up ${totalDeleted} old metrics logs (CPU: ${results.cpu}, Memory: ${results.memory}, Disk: ${results.disk})`
    });
  } catch (error) {
    console.error("[system] Failed to cleanup metrics logs", error);
    return NextResponse.json(
      { message: "Unable to cleanup metrics logs at this time." },
      { status: 500 }
    );
  }
}, { permission: "settings:edit" });

