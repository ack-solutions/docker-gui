import "dotenv/config";
import bcrypt from "bcryptjs";
import type { Domain, DomainUpsertInput } from "../src/types/server";

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

// Prevent nginx tests from touching the host daemon while running verification.
if (!process.env.NGINX_APPLY_DRY_RUN) {
  process.env.NGINX_APPLY_DRY_RUN = "true";
}

type DomainRoutesModule = typeof import("../src/app/api/domains/route");
type DomainDetailRoutesModule = typeof import("../src/app/api/domains/[domainId]/route");

interface TestContext {
  prisma: typeof import("../src/server/database/client")["prisma"];
  authService: typeof import("../src/server/auth/auth-service")["authService"];
  config: typeof import("../src/server/config")["config"];
  userPermissions: typeof import("../src/types/user")["userPermissions"];
  listDomainsRoute: DomainRoutesModule["GET"];
  createDomainRoute: DomainRoutesModule["POST"];
  getDomainRoute: DomainDetailRoutesModule["GET"];
  updateDomainRoute: DomainDetailRoutesModule["PUT"];
  deleteDomainRoute: DomainDetailRoutesModule["DELETE"];
}

const API_BASE = "https://integration.test.local/api";

const assertCondition = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const buildRequest = (token: string, init: RequestInit & { jsonBody?: unknown }, path: string) => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (init.jsonBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.jsonBody);
  } else {
    body = init.body as BodyInit | undefined;
  }

  return new Request(`${API_BASE}${path}`, {
    method: init.method,
    headers,
    body
  });
};

const parseJson = async <T>(label: string, response: Response): Promise<T> => {
  const text = await response.text();
  let parsed: any = undefined;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      if (response.ok) {
        throw new Error(`[${label}] Failed to parse JSON response: ${(error as Error).message}`);
      }
    }
  }

  if (!response.ok) {
    const message = parsed?.message ?? (text || response.statusText);
    throw new Error(`[${label}] ${response.status} ${message}`);
  }

  return parsed as T;
};

const readEmptyResponse = async (label: string, response: Response) => {
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try {
      const json = JSON.parse(text);
      message = json?.message ?? message;
    } catch {
      if (text) {
        message = text;
      }
    }
    throw new Error(`[${label}] ${response.status} ${message}`);
  }
  // Drain the body to keep Node happy.
  await response.arrayBuffer();
};

const seedTestUser = async (
  prisma: TestContext["prisma"],
  config: TestContext["config"],
  email: string,
  permissions: ReadonlyArray<string>
) => {
  const password = `Adm1n!${Math.random().toString(36).slice(2, 10)}`;
  const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Integration Runner",
      role: "admin",
      permissions: [...permissions],
      isSuperAdmin: true
    }
  });

  return { user, password };
};

const prepareContext = async (): Promise<TestContext> => {
  const [{ prisma }, { authService }, { config }, { userPermissions }, domainRoutes, domainDetailRoutes] =
    await Promise.all([
      import("../src/server/database/client"),
      import("../src/server/auth/auth-service"),
      import("../src/server/config"),
      import("../src/types/user"),
      import("../src/app/api/domains/route"),
      import("../src/app/api/domains/[domainId]/route")
    ]);

  return {
    prisma,
    authService,
    config,
    userPermissions,
    listDomainsRoute: domainRoutes.GET,
    createDomainRoute: domainRoutes.POST,
    getDomainRoute: domainDetailRoutes.GET,
    updateDomainRoute: domainDetailRoutes.PUT,
    deleteDomainRoute: domainDetailRoutes.DELETE
  };
};

const describeDomain = (domain: Domain) => ({
  id: domain.id,
  name: domain.name,
  status: domain.status,
  targetType: domain.target?.type ?? "none",
  sslMode: domain.target?.sslMode ?? "none",
  serverAliasCount: domain.aliases.length,
  recordCount: domain.records.length
});

const buildCreatePayload = (domainName: string): DomainUpsertInput => ({
  name: domainName,
  aliases: [`www.${domainName}`],
  mode: "managed",
  status: "pending",
  notes: "integration test domain",
  target: {
    type: "service",
    serviceHost: "app.internal:8080",
    enableHttp: true,
    enableHttps: true,
    forceHttps: false,
    sslMode: "custom",
    sslCertificateId: `integration-cert-${Date.now()}`,
    letsEncryptEmail: null,
    customNginxConfig: "proxy_read_timeout 90;\nproxy_send_timeout 90;"
  },
  records: [
    { type: "A", host: "@", value: "10.42.0.10", ttl: 600 },
    { type: "CNAME", host: "www", value: domainName, ttl: 600 }
  ],
  dnsProvider: null
});

const buildUpdatePayload = (current: Domain): DomainUpsertInput => {
  if (!current.records.length) {
    throw new Error("Domain must include at least one DNS record for update verification.");
  }

  const firstRecord = current.records[0];
  return {
    name: current.name,
    aliases: [`edge.${current.name}`],
    mode: "managed",
    status: "active",
    notes: "integration test domain (updated)",
    target: {
      type: "external",
      externalUrl: "https://status.internal.example.net",
      enableHttp: true,
      enableHttps: false,
      forceHttps: false,
      sslMode: "none",
      sslCertificateId: null,
      customNginxConfig: "proxy_cache_bypass $http_upgrade;\nproxy_connect_timeout 30;"
    },
    records: [
      {
        id: firstRecord.id,
        type: firstRecord.type,
        host: firstRecord.host,
        value: "10.42.0.25",
        ttl: 1200
      },
      {
        type: "TXT",
        host: "_integration",
        value: "docker-gui",
        ttl: 300
      }
    ],
    dnsProvider: null
  };
};

const run = async () => {
  const context = await prepareContext();
  const testEmail = `integration+${Date.now()}@docker-gui.test`;
  const createdResources: { userId?: string; domainId?: string; nginxSiteId?: string } = {};

  try {
    console.log("🔐 Seeding dedicated test user...");
    const { user, password } = await seedTestUser(context.prisma, context.config, testEmail, context.userPermissions);
    createdResources.userId = user.id;

    const auth = await context.authService.login({ email: testEmail, password });
    const token = auth.token;

    const domainName = `integration-${Date.now()}.example.test`;
    const createPayload = buildCreatePayload(domainName);

    console.log("🌐 Creating domain via API...");
    const createRequest = buildRequest(token, { method: "POST", jsonBody: createPayload }, "/domains");
    const createdDomain = (await parseJson<Domain>("create domain", await context.createDomainRoute(createRequest, {} as any)));
    createdResources.domainId = createdDomain.id;
    createdResources.nginxSiteId = createdDomain.nginxSiteId ?? undefined;
    console.log("   → Created:", describeDomain(createdDomain));
    assertCondition(createdDomain.nginxSiteId, "Domain creation did not provision an Nginx site.");

    const createdSite = await context.prisma.nginxSite.findUnique({ where: { id: createdDomain.nginxSiteId! } });
    assertCondition(createdSite, "Nginx site record missing after domain creation.");
    assertCondition(createdSite?.extraDirectives?.includes("proxy_read_timeout"), "Custom Nginx directives missing on initial site.");
    assertCondition(createdSite?.sslMode === "custom", "Nginx site SSL mode should be custom after creation.");

    console.log("📄 Listing domains...");
    const listRequest = buildRequest(token, { method: "GET" }, "/domains");
    const domainList = await parseJson<Domain[]>("list domains", await context.listDomainsRoute(listRequest, {} as any));
    assertCondition(domainList.some((domain) => domain.id === createdDomain.id), "Created domain missing from listing.");

    console.log("🔍 Fetching domain details...");
    const detailRequest = buildRequest(token, { method: "GET" }, `/domains/${createdDomain.id}`);
    const fetchedDomain = await parseJson<Domain>(
      "get domain",
      await context.getDomainRoute(detailRequest, { params: { domainId: createdDomain.id } })
    );
    assertCondition(fetchedDomain.records.length === createPayload.records!.length, "Unexpected DNS record count on fetched domain.");

    console.log("✏️ Updating domain + nginx config via API...");
    const updatePayload = buildUpdatePayload(fetchedDomain);
    const updateRequest = buildRequest(token, { method: "PUT", jsonBody: updatePayload }, `/domains/${createdDomain.id}`);
    const updatedDomain = await parseJson<Domain>(
      "update domain",
      await context.updateDomainRoute(updateRequest, { params: { domainId: createdDomain.id } })
    );
    console.log("   → Updated:", describeDomain(updatedDomain));
    assertCondition(updatedDomain.aliases.includes(`edge.${updatedDomain.name}`), "Updated alias missing on domain.");
    assertCondition(updatedDomain.records.length === updatePayload.records!.length, "Domain records not updated as expected.");
    assertCondition(updatedDomain.target?.type === "external", "Domain target should now be external.");
    assertCondition(updatedDomain.target?.customNginxConfig === updatePayload.target?.customNginxConfig, "Custom Nginx config mismatch after update.");

    const updatedSite = await context.prisma.nginxSite.findUnique({ where: { id: updatedDomain.nginxSiteId! } });
    assertCondition(updatedSite, "Nginx site missing after update.");
    assertCondition(updatedSite?.upstreamType === "external", "Nginx site upstream type not updated.");
    assertCondition(updatedSite?.upstreamTarget === updatePayload.target?.externalUrl, "Nginx upstream target mismatch.");
    assertCondition(updatedSite?.sslMode === "none", "Nginx SSL mode mismatch after update.");
    assertCondition(updatedSite?.extraDirectives === updatePayload.target?.customNginxConfig, "Custom directives not propagated to Nginx site.");

    console.log("🧹 Deleting domain via API...");
    const deleteRequest = buildRequest(token, { method: "DELETE" }, `/domains/${createdDomain.id}`);
    await readEmptyResponse(
      "delete domain",
      await context.deleteDomainRoute(deleteRequest, { params: { domainId: createdDomain.id } })
    );
    createdResources.domainId = undefined;

    const domainAfterDelete = await context.prisma.domain.findUnique({ where: { id: createdDomain.id } });
    assertCondition(!domainAfterDelete, "Domain record still present after deletion.");
    const siteAfterDelete = createdDomain.nginxSiteId
      ? await context.prisma.nginxSite.findUnique({ where: { id: createdDomain.nginxSiteId } })
      : null;
    assertCondition(!siteAfterDelete, "Nginx site still present after domain deletion.");

    console.log("✅ Domain + SSL/Nginx API workflow verified successfully.");
  } finally {
    if (createdResources.domainId) {
      await context.prisma.domain.delete({ where: { id: createdResources.domainId } }).catch(() => undefined);
    }
    if (createdResources.nginxSiteId) {
      await context.prisma.nginxSite.delete({ where: { id: createdResources.nginxSiteId } }).catch(() => undefined);
    }
    if (createdResources.userId) {
      await context.prisma.user.delete({ where: { id: createdResources.userId } }).catch(() => undefined);
    }
    await context.prisma.$disconnect();
  }
};

run().catch((error) => {
  console.error("❌ Domain/Nginx API verification failed:", error);
  process.exitCode = 1;
});
