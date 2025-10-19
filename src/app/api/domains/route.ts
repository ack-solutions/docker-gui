import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { listDomains, createDomain } from "@/server/domain/domain-service";

export const runtime = "nodejs";

export const GET = withAuth(
  async () => {
    const domains = await listDomains();
    return NextResponse.json(domains);
  },
  {
    permission: "domains:view"
  }
);

export const POST = withAuth(
  async (request: Request) => {
    try {
      const payload = await request.json();
      const domain = await createDomain(payload);
      return NextResponse.json(domain, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create domain";
      return NextResponse.json({ message }, { status: 400 });
    }
  },
  {
    permission: "domains:manage"
  }
);
