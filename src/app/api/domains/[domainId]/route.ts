import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth/authorization";
import { getDomain, updateDomain, deleteDomain } from "@/server/domain/domain-service";

interface RouteContext {
  params: {
    domainId: string;
  };
}

export const runtime = "nodejs";

export const GET = withAuth(
  async (_request: Request, context: RouteContext) => {
    const domain = await getDomain(context.params.domainId);
    if (!domain) {
      return NextResponse.json({ message: "Domain not found" }, { status: 404 });
    }
    return NextResponse.json(domain);
  },
  {
    permission: "domains:view"
  }
);

export const PUT = withAuth(
  async (request: Request, context: RouteContext) => {
    try {
      const payload = await request.json();
      const domain = await updateDomain(context.params.domainId, payload);
      return NextResponse.json(domain);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update domain";
      const status = message === "Domain not found" ? 404 : 400;
      return NextResponse.json({ message }, { status });
    }
  },
  {
    permission: "domains:manage"
  }
);

export const DELETE = withAuth(
  async (_request: Request, context: RouteContext) => {
    await deleteDomain(context.params.domainId);
    return new NextResponse(null, { status: 204 });
  },
  {
    permission: "domains:manage"
  }
);
