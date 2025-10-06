import { NextRequest, NextResponse } from "next/server";
import { getContainerLogs } from "@/server/docker/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const containerId = params?.id;

  if (!containerId) {
    return NextResponse.json({ message: "Container id is required." }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const tailParam = url.searchParams.get("tail");
    const sinceParam = url.searchParams.get("since");

    const tail = tailParam ? Number.parseInt(tailParam, 10) : undefined;
    const since = sinceParam ? new Date(sinceParam) : undefined;

    if (since && Number.isNaN(since.getTime())) {
      return NextResponse.json({ message: "Invalid since parameter." }, { status: 400 });
    }

    const logs = await getContainerLogs(containerId, { tail, since });
    return NextResponse.json(logs);
  } catch (error) {
    console.error(`Failed to fetch logs for container ${containerId}`, error);
    return NextResponse.json({ message: "Unable to retrieve logs." }, { status: 500 });
  }
}
