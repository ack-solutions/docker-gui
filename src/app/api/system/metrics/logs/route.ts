import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { MetricsLoggingService } from "@/server/system/metrics-logging-service";

export const runtime = "nodejs";

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") as "cpu" | "memory" | "disk" | null;
    const limit = Number(searchParams.get("limit") || "100");
    const offset = Number(searchParams.get("offset") || "0");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const loggingService = MetricsLoggingService.getInstance();

    // If no type specified, return from all types (for combined view)
    if (!type) {
      const [cpuLogs, memoryLogs, diskLogs] = await Promise.all([
        startDate && endDate
          ? loggingService.getLogsByTimeRange("cpu", new Date(startDate), new Date(endDate), limit)
          : loggingService.getRecentLogs("cpu", limit, offset),
        startDate && endDate
          ? loggingService.getLogsByTimeRange("memory", new Date(startDate), new Date(endDate), limit)
          : loggingService.getRecentLogs("memory", limit, offset),
        startDate && endDate
          ? loggingService.getLogsByTimeRange("disk", new Date(startDate), new Date(endDate), limit)
          : loggingService.getRecentLogs("disk", limit, offset)
      ]);

      return NextResponse.json({
        cpu: { logs: cpuLogs, count: cpuLogs.length },
        memory: { logs: memoryLogs, count: memoryLogs.length },
        disk: { logs: diskLogs, count: diskLogs.length }
      });
    }

    // Get logs for specific type
    let logs;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      logs = await loggingService.getLogsByTimeRange(type, start, end, limit);
    } else {
      logs = await loggingService.getRecentLogs(type, limit, offset);
    }

    return NextResponse.json({
      logs,
      count: logs.length,
      type
    });
  } catch (error) {
    console.error("[system] Failed to fetch metrics logs", error);
    return NextResponse.json(
      { message: "Unable to fetch metrics logs at this time." },
      { status: 500 }
    );
  }
}, { permission: "dashboard:view" });

