import { Prisma } from "@prisma/client";
import * as yup from "yup";
import { prisma } from "@/server/database/client";
import {
  createNginxSite,
  updateNginxSite,
  deleteNginxSite
} from "@/server/nginx/nginx-site-service";
import { syncExternalDnsRecords } from "@/server/domain/dns-provider-service";
import type {
  Domain,
  DomainDnsRecord,
  DomainDnsRecordType,
  DomainTarget,
  DomainTargetType,
  DomainUpsertInput,
  NginxSslMode,
  DomainStatus
} from "@/types/server";

/**
 * Formats yup ValidationError into a user-friendly error message
 */
export const formatValidationError = (error: unknown): string => {
  if (error instanceof yup.ValidationError) {
    if (error.inner && error.inner.length > 0) {
      // Format multiple validation errors
      const errorMessages = error.inner.map((err) => {
        const path = err.path || "field";
        // Convert path like "target.containerId" to "Container ID" or keep original
        const fieldName = formatFieldName(path);
        return `• ${fieldName}: ${err.message}`;
      });

      const errorCount = error.inner.length;
      const header = errorCount === 1
        ? "Validation error:"
        : `${errorCount} validation errors found:`;

      return `${header}\n\n${errorMessages.join("\n")}`;
    }
    // Single error or no inner errors
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Validation failed. Please check your input.";
};

/**
 * Converts field paths to user-friendly names
 */
const formatFieldName = (path: string): string => {
  const fieldMap: Record<string, string> = {
    "name": "Domain name",
    "target.containerId": "Container",
    "target.containerPort": "Container port",
    "target.externalUrl": "External URL",
    "target.serviceHost": "Service host",
    "target.staticRoot": "Static directory",
    "target.letsEncryptEmail": "Email address",
    "target.sslMode": "SSL mode",
    "parentDomainId": "Parent domain",
    "records": "DNS records",
    "dnsProvider.type": "DNS provider",
    "managed": "Managed flag",
  };

  // Check exact match first
  if (fieldMap[path]) {
    return fieldMap[path];
  }

  // Check if it's a nested path like "records[0].host"
  const arrayMatch = path.match(/^records\[(\d+)\]\.(.+)$/);
  if (arrayMatch) {
    const index = parseInt(arrayMatch[1]) + 1;
    const field = arrayMatch[2];
    const fieldName = fieldMap[`records.${field}`] || field;
    return `DNS Record #${index} - ${fieldName}`;
  }

  // Check if it starts with a known prefix
  for (const [key, value] of Object.entries(fieldMap)) {
    if (path.startsWith(key + ".")) {
      const rest = path.substring(key.length + 1);
      return `${value} - ${rest}`;
    }
  }

  // Default: capitalize and replace dots/underscores
  return path
    .split(/[._]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const domainNamePattern = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;
const urlPattern = /^https?:\/\//i;

const dnsRecordSchema = yup
  .object({
    id: yup.string().uuid().nullable().optional(),
    type: yup.string<DomainDnsRecordType>().oneOf(["A", "AAAA", "CNAME", "TXT", "MX", "SRV", "CAA", "NS"]).required(),
    host: yup.string().trim().min(1).max(255).required(),
    value: yup.string().trim().min(1).max(2048).required(),
    ttl: yup
      .number()
      .transform((value, originalValue) => (originalValue === "" || originalValue === undefined ? undefined : Number(originalValue)))
      .integer()
      .positive()
      .max(86_400)
      .default(300),
    priority: yup
      .number()
      .transform(function(value, originalValue) {
        // Handle empty string, undefined, null as "not provided"
        if (originalValue === "" || originalValue === undefined || originalValue === null) {
          // For MX and SRV records, priority is required - default to 0
          const record = (this as any).parent;
          if (record && (record.type === 'MX' || record.type === 'SRV')) {
            return 0;
          }
          return undefined;
        }
        const num = Number(originalValue);
        // Allow 0 as a valid priority value
        return isNaN(num) ? undefined : num;
      })
      .integer()
      .min(0, "Priority must be 0 or greater")
      .nullable()
      .optional()
  })
  .noUnknown();

const dnsProviderSchema = yup
  .object({
    type: yup.string().trim().min(2).nullable().optional(),
    config: yup.mixed<Record<string, unknown>>().optional()
  })
  .nullable()
  .optional();

const domainTargetSchema = yup
  .object({
    type: yup.string<DomainTargetType>().oneOf(["none", "container", "service", "external", "static"]).default("none"),
    containerId: yup.string().trim().max(128).nullable().optional(),
    containerPort: yup
      .number()
      .transform((value, originalValue) => (originalValue === "" || originalValue === undefined ? undefined : Number(originalValue)))
      .integer()
      .positive()
      .max(65535)
      .nullable()
      .optional(),
    serviceHost: yup.string().trim().max(512).nullable().optional(),
    externalUrl: yup.string().trim().max(2048).nullable().optional(),
    staticRoot: yup.string().trim().max(1024).nullable().optional(),
    enableHttp: yup.boolean().default(true),
    enableHttps: yup.boolean().default(true),
    forceHttps: yup.boolean().default(false),
    sslMode: yup.string<NginxSslMode>().oneOf(["none", "lets-encrypt", "custom"]).default("lets-encrypt"),
    letsEncryptEmail: yup.string().email().nullable().optional(),
    sslCertificateId: yup.string().trim().max(256).nullable().optional(),
    customNginxConfig: yup.string().trim().max(8000).nullable().optional()
  })
  .default(() => ({
    type: "none",
    enableHttp: true,
    enableHttps: true,
    forceHttps: false,
    sslMode: "lets-encrypt"
  }))
  .test("target-config", "Invalid target configuration", function (value) {
    if (!value) return true;

    // Only validate container fields if container type is selected
    if (value.type === "container") {
      if (!value.containerId) {
        return this.createError({ path: `${this.path}.containerId`, message: "Container is required" });
      }
      if (!value.containerPort) {
        return this.createError({ path: `${this.path}.containerPort`, message: "Port is required" });
      }
    }

    // Only validate service fields if service type is selected
    if (value.type === "service" && !value.serviceHost) {
      return this.createError({ path: `${this.path}.serviceHost`, message: "Service host is required" });
    }

    // Only validate external URL if external type is selected
    if (value.type === "external") {
      if (!value.externalUrl || value.externalUrl.trim().length === 0) {
        return this.createError({ path: `${this.path}.externalUrl`, message: "URL is required" });
      }
      // Auto-add http:// if no protocol is specified (make it more lenient)
      // Validation will pass, but we'll normalize it in the buildDomainData function
    }

    // Only validate static root if static type is selected
    if (value.type === "static" && (!value.staticRoot || value.staticRoot.trim().length === 0)) {
      return this.createError({ path: `${this.path}.staticRoot`, message: "Static directory is required" });
    }


    // Email validation for Let's Encrypt - only validate format if provided
    // Email is optional, but if provided and HTTPS/Let's Encrypt are enabled, it must be valid
    if (value.type !== "none" && value.enableHttps === true && value.sslMode === "lets-encrypt") {
      if (value.letsEncryptEmail && value.letsEncryptEmail.trim() !== "") {
        // Validate email format only if email is actually provided
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.letsEncryptEmail.trim())) {
          return this.createError({ path: `${this.path}.letsEncryptEmail`, message: "Invalid email format" });
        }
      }
      // Email is optional - don't require it
    }
    return true;
  });

const domainInputSchema = yup
  .object({
    name: yup
      .string()
      .trim()
      .min(3)
      .max(255)
      .matches(domainNamePattern, "Invalid domain name")
      .required(),
    aliases: yup.array().of(yup.string().trim().min(1).max(255)).transform((value) => value?.filter(Boolean) ?? []).default([]),
    provider: yup.string().trim().max(120).nullable().optional(),
    mode: yup
      .string()
      .oneOf(["managed", "provider", "manual", "external-dns", "pointer-only", "nameserver", "third-party", "proxy-only"])
      .optional(),
    managed: yup.boolean().optional(),
    status: yup.string<DomainStatus>().oneOf(["active", "pending", "error"]).default("pending"),
    notes: yup.string().trim().max(2000).nullable().optional(),
    target: domainTargetSchema,
    records: yup.array().of(dnsRecordSchema).default([]),
    dnsProvider: dnsProviderSchema,
    parentDomainId: yup.string().uuid().nullable().optional()
  })
  .test("managed-coherence", "Managed flag does not match selected domain mode", function (value) {
    if (!value) return true; // Make this more lenient - return true instead of false
    if (value.mode && value.managed !== undefined) {
      const expected = value.mode === "managed";
      if (value.managed !== expected) {
        return this.createError({ path: "managed", message: "Managed flag does not match selected domain mode" });
      }
    }
    return true;
  })
  .test("dns-provider-required", "DNS provider type is required for provider mode", function (value) {
    if (!value) return true;
    // Only require dnsProvider.type if mode is "provider" or "third-party"
    // Check both the normalized mode and the original mode values
    const normalizedMode = normalizeDomainMode(value.mode);
    const originalMode = value.mode;

    // Check if mode is provider-related (before or after normalization)
    const isProviderMode = normalizedMode === "provider" ||
      originalMode === "provider" ||
      originalMode === "third-party";

    if (isProviderMode) {
      // If dnsProvider object is provided, it must have a type
      // But if dnsProvider is not provided at all, that's okay (it's optional)
      if (value.dnsProvider !== undefined && value.dnsProvider !== null && !value.dnsProvider.type) {
        return this.createError({
          path: "dnsProvider.type",
          message: "DNS provider type is required when using provider mode"
        });
      }
    }
    return true;
  })
  .transform((value: any) => {
    const resolvedMode =
      value?.mode ?? (value?.managed === true ? "managed" : value?.managed === false ? "manual" : "managed");
    const { managed: _legacyManaged, ...rest } = value ?? {};
    return { ...rest, mode: normalizeDomainMode(resolvedMode) };
  })
  .noUnknown();

type DomainWithRecords = Prisma.DomainGetPayload<{ include: { records: true; parentDomain: true } }>;

type DomainManagementMode = "managed" | "provider" | "manual";

interface ProviderSyncContext {
  domainId: string;
  provider: string;
  domainName: string;
  config: Record<string, unknown>;
  records: DomainWithRecords["records"];
}

const normalizeDomainMode = (input?: string | null): DomainManagementMode => {
  switch (input) {
    case "provider":
    case "third-party":
      return "provider";
    case "manual":
    case "external-dns":
    case "pointer-only":
    case "proxy-only":
      return "manual";
    case "nameserver":
    case "managed":
    default:
      return "managed";
  }
};

const jsonToStringArray = (value: Prisma.JsonValue | null | undefined): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
};

const toConfigObject = (value: Prisma.JsonValue | null): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const mapRecordEntity = (record: DomainWithRecords["records"][number]): DomainDnsRecord => ({
  id: record.id,
  type: record.type as DomainDnsRecord["type"],
  host: record.host,
  value: record.value,
  ttl: record.ttl,
  priority: record.priority ?? null,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString()
});

const mapDnsProviderInfo = (entity: DomainWithRecords) => {
  if (!entity.dnsProviderType) {
    return null;
  }

  const config = (entity.dnsProviderConfig ?? null) as Record<string, unknown> | null;
  return {
    type: entity.dnsProviderType,
    configured: Boolean(config && Object.keys(config).length),
    configKeys: config ? Object.keys(config) : []
  };
};

const mapTarget = (entity: DomainWithRecords): DomainTarget | null => {
  if (entity.targetType === "none") {
    return null;
  }

  return {
    type: entity.targetType as DomainTarget["type"],
    containerId: entity.targetContainerId ?? null,
    containerPort: entity.targetContainerPort ?? null,
    serviceHost: entity.targetServiceHost ?? null,
    externalUrl: entity.targetExternalUrl ?? null,
    staticRoot: entity.targetStaticRoot ?? null,
    enableHttp: entity.enableHttp,
    enableHttps: entity.enableHttps,
    forceHttps: entity.forceHttps,
    sslMode: entity.sslMode as DomainTarget["sslMode"],
    letsEncryptEmail: entity.letsEncryptEmail ?? null,
    sslCertificateId: entity.sslCertificateId ?? null,
    customNginxConfig: entity.customNginxConfig ?? null
  };
};

const mapDomainEntity = (entity: DomainWithRecords): Domain => ({
  id: entity.id,
  name: entity.name,
  aliases: jsonToStringArray(entity.aliases),
  provider: entity.provider ?? null,
  mode: normalizeDomainMode(entity.mode),
  status: entity.status as Domain["status"],
  notes: entity.notes ?? null,
  target: mapTarget(entity),
  nginxSiteId: entity.nginxSiteId ?? null,
  lastError: entity.lastError ?? null,
  parentDomainId: entity.parentDomainId ?? null,
  parentDomainName: entity.parentDomain?.name ?? null,
  createdAt: entity.createdAt.toISOString(),
  updatedAt: entity.updatedAt.toISOString(),
  records: (entity.records ?? []).map(mapRecordEntity),
  dnsProvider: mapDnsProviderInfo(entity)
});

const buildProviderSyncContext = (entity: DomainWithRecords): ProviderSyncContext | null => {
  if (normalizeDomainMode(entity.mode) !== "provider") {
    return null;
  }

  if (!entity.dnsProviderType) {
    return null;
  }

  const config = toConfigObject(entity.dnsProviderConfig);
  if (!config) {
    return null;
  }

  return {
    domainId: entity.id,
    provider: entity.dnsProviderType,
    domainName: entity.name,
    config,
    records: entity.records ?? []
  };
};

const syncProviderRecords = async (context: ProviderSyncContext | null) => {
  if (!context) {
    return;
  }

  try {
    await syncExternalDnsRecords({
      provider: context.provider,
      domainName: context.domainName,
      config: context.config,
      records: context.records.map((record) => ({
        type: record.type,
        host: record.host,
        value: record.value,
        ttl: record.ttl ?? 300,
        priority: record.priority ?? null
      }))
    });
    await prisma.domain.update({
      where: { id: context.domainId },
      data: { lastError: null }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to synchronize DNS provider";
    await prisma.domain.update({
      where: { id: context.domainId },
      data: { lastError: message, status: "error" }
    });
    throw new Error(message);
  }
};

const normalizeAliases = (aliases: string[]): string[] =>
  Array.from(
    new Set(
      aliases
        .map((alias) => alias.trim().toLowerCase())
        .filter((alias) => alias.length > 0)
    )
  );

const reconcileNginxSite = async (
  domain: { id: string; name: string; aliases: string[]; nginxSiteId: string | null; notes?: string | null },
  payload: yup.InferType<typeof domainInputSchema>
): Promise<string | null> => {
  const target = payload.target;

  if (!target || target.type === "none") {
    if (domain.nginxSiteId) {
      await deleteNginxSite(domain.nginxSiteId);
    }
    return null;
  }

  const serverNames = [domain.name, ...domain.aliases].filter(Boolean);

  // Map to supported upstream types for Nginx site service ("static" handled via staticRoot)
  const upstreamType: "container" | "service" | "external" =
    target.type === "container"
      ? "container"
      : target.type === "service"
        ? "service"
        : "external";

  const siteRequest = {
    primaryDomain: domain.name,
    serverNames,
    upstreamType,
    upstreamTarget:
      target.type === "service"
        ? target.serviceHost ?? ""
        : target.type === "external"
          ? target.externalUrl ?? ""
          : target.type === "container"
            ? target.containerId ?? ""
            : "",
    staticRoot: target.type === "static" ? target.staticRoot ?? "" : undefined,
    containerId: target.containerId ?? undefined,
    containerPort: target.containerPort ?? undefined,
    enableHttp: target.enableHttp,
    enableHttps: target.enableHttps,
    forceHttps: target.forceHttps,
    sslMode: target.sslMode,
    letsEncryptEmail: target.letsEncryptEmail ?? undefined,
    sslCertificateId: target.sslCertificateId ?? undefined,
    enabled: true,
    notes: payload.notes ?? undefined,
    extraDirectives: target.customNginxConfig ?? undefined
  } as const;

  if (target.type === "service" && !siteRequest.upstreamTarget) {
    throw new Error("Service host is required");
  }
  if (target.type === "external" && !siteRequest.upstreamTarget) {
    throw new Error("External URL is required");
  }
  if (target.type === "static" && !siteRequest.staticRoot) {
    throw new Error("Static directory is required");
  }

  if (domain.nginxSiteId) {
    const site = await updateNginxSite(domain.nginxSiteId, siteRequest);
    return site.id;
  }

  const site = await createNginxSite(siteRequest);
  return site.id;
};

export const listDomains = async (): Promise<Domain[]> => {
  const domains = await prisma.domain.findMany({
    include: { records: true, parentDomain: true },
    orderBy: { name: "asc" }
  });
  return domains.map((domain) => mapDomainEntity(domain));
};

export const getDomain = async (domainId: string): Promise<Domain | null> => {
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    include: { records: true, parentDomain: true }
  });
  return domain ? mapDomainEntity(domain) : null;
};

const normalizeExternalUrl = (url: string | null | undefined): string | null => {
  if (!url || url.trim().length === 0) {
    return null;
  }
  const trimmed = url.trim();
  // Auto-add http:// if no protocol is specified
  if (!urlPattern.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
};

const buildDomainData = (
  payload: yup.InferType<typeof domainInputSchema>,
  aliases: string[],
  parentDomainId?: string | null
) => ({
  name: payload.name.toLowerCase(),
  aliases,
  provider: payload.provider ?? payload.dnsProvider?.type ?? null,
  dnsProviderType: payload.dnsProvider?.type ?? null,
  dnsProviderConfig: payload.dnsProvider?.config ?? null,
  mode: normalizeDomainMode(payload.mode),
  status: payload.status,
  parentDomainId: parentDomainId ?? null,
  notes: payload.notes ?? null,
  targetType: payload.target.type,
  targetContainerId: payload.target.containerId ?? null,
  targetContainerPort: payload.target.containerPort ?? null,
  targetServiceHost: payload.target.serviceHost ?? null,
  targetExternalUrl: normalizeExternalUrl(payload.target.externalUrl),
  targetStaticRoot: payload.target.staticRoot ?? null,
  enableHttp: payload.target.enableHttp,
  enableHttps: payload.target.enableHttps,
  forceHttps: payload.target.forceHttps,
  sslMode: payload.target.sslMode,
  letsEncryptEmail: payload.target.letsEncryptEmail ?? null,
  sslCertificateId: payload.target.sslCertificateId ?? null,
  customNginxConfig: payload.target.customNginxConfig ?? null
});

const ensureParentDomain = async (parentDomainId: string | null, name: string, currentDomainId?: string) => {
  if (!parentDomainId) {
    return null;
  }

  const parent = await prisma.domain.findUnique({ where: { id: parentDomainId } });
  if (!parent) {
    throw new Error("Parent domain not found");
  }

  if (currentDomainId && parent.id === currentDomainId) {
    throw new Error("A domain cannot reference itself as a parent.");
  }

  if (!name.endsWith(parent.name)) {
    throw new Error("Subdomain must belong to the selected parent domain.");
  }

  return parent;
};

export const createDomain = async (input: DomainUpsertInput): Promise<Domain> => {
  let payload: yup.InferType<typeof domainInputSchema>;
  try {
    payload = await domainInputSchema.validate(input, { abortEarly: false });
  } catch (error) {
    throw new Error(formatValidationError(error));
  }
  const aliases = normalizeAliases(payload.aliases);
  const normalizedName = payload.name.toLowerCase().trim();
  const parent = await ensureParentDomain(payload.parentDomainId ?? null, normalizedName);

  const result = await prisma.$transaction(async (tx) => {
    const domain = await tx.domain.create({
      data: buildDomainData(payload, aliases, parent?.id ?? null) as Prisma.DomainUncheckedCreateInput
    });

    if (payload.records.length) {
      await tx.domainRecord.createMany({
        data: payload.records.map((record) => ({
          domainId: domain.id,
          type: record.type,
          host: record.host.trim(),
          value: record.value.trim(),
          ttl: record.ttl ?? 300,
          priority: record.priority ?? null
        }))
      });
    }

    const refreshed = await tx.domain.findUnique({
      where: { id: domain.id },
      include: { records: true, parentDomain: true }
    });

    if (!refreshed) {
      throw new Error("Failed to load domain after creation");
    }

    return {
      domain: refreshed,
      providerContext: buildProviderSyncContext(refreshed)
    };
  }, { timeout: 20000 });

  // Reconcile Nginx site OUTSIDE the transaction to avoid timeouts
  let finalDomain = result.domain;
  if (payload.target.type !== "none") {
    const newNginxSiteId = await reconcileNginxSite(
      {
        id: finalDomain.id,
        name: finalDomain.name,
        aliases: jsonToStringArray(finalDomain.aliases),
        nginxSiteId: finalDomain.nginxSiteId ?? null,
        notes: payload.notes ?? null
      },
      payload
    );
    if (newNginxSiteId !== finalDomain.nginxSiteId) {
      await prisma.domain.update({ where: { id: finalDomain.id }, data: { nginxSiteId: newNginxSiteId } });
      // Reload to ensure we return latest state
      const reloaded = await prisma.domain.findUnique({
        where: { id: finalDomain.id },
        include: { records: true, parentDomain: true }
      });
      if (reloaded) {
        finalDomain = reloaded;
      }
    }
  } else if (finalDomain.nginxSiteId) {
    // If target is none and a site exists, delete it and clear reference
    await deleteNginxSite(finalDomain.nginxSiteId);
    await prisma.domain.update({ where: { id: finalDomain.id }, data: { nginxSiteId: null } });
    const reloaded = await prisma.domain.findUnique({
      where: { id: finalDomain.id },
      include: { records: true, parentDomain: true }
    });
    if (reloaded) {
      finalDomain = reloaded;
    }
  }

  await syncProviderRecords(buildProviderSyncContext(finalDomain));

  return mapDomainEntity(finalDomain);
};

export const updateDomain = async (domainId: string, input: DomainUpsertInput): Promise<Domain> => {
  let payload: yup.InferType<typeof domainInputSchema>;
  try {
    payload = await domainInputSchema.validate(input, { abortEarly: false });
  } catch (error) {
    throw new Error(formatValidationError(error));
  }
  const aliases = normalizeAliases(payload.aliases);
  const normalizedName = payload.name.toLowerCase().trim();
  const parent = await ensureParentDomain(payload.parentDomainId ?? null, normalizedName, domainId);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.domain.findUnique({
      where: { id: domainId },
      include: { records: true, parentDomain: true }
    });

    if (!existing) {
      throw new Error("Domain not found");
    }

    await tx.domain.update({
      where: { id: domainId },
      data: buildDomainData(payload, aliases, parent?.id ?? null) as Prisma.DomainUncheckedUpdateInput
    });

    const incomingRecords = payload.records;
    const incomingIds = new Set((incomingRecords ?? []).map((record) => record.id).filter(Boolean) as string[]);
    const recordsToDelete = existing.records.filter((record) => !incomingIds.has(record.id)).map((record) => record.id);

    if (recordsToDelete.length) {
      await tx.domainRecord.deleteMany({ where: { id: { in: recordsToDelete } } });
    }

    for (const record of incomingRecords) {
      if (record.id) {
        await tx.domainRecord.updateMany({
          where: { id: record.id, domainId },
          data: {
            type: record.type,
            host: record.host.trim(),
            value: record.value.trim(),
            ttl: record.ttl ?? 300,
            priority: record.priority ?? null
          }
        });
      } else {
        await tx.domainRecord.create({
          data: {
            domainId,
            type: record.type,
            host: record.host.trim(),
            value: record.value.trim(),
            ttl: record.ttl ?? 300,
            priority: record.priority ?? null
          }
        });
      }
    }

    const refreshed = await tx.domain.findUnique({
      where: { id: existing.id },
      include: { records: true, parentDomain: true }
    });

    if (!refreshed) {
      throw new Error("Failed to load domain after update");
    }

    return {
      domain: refreshed,
      providerContext: buildProviderSyncContext(refreshed)
    };
  }, { timeout: 20000 });

  // Reconcile Nginx site OUTSIDE the transaction to avoid timeouts
  let finalDomain = result.domain;
  if (payload.target.type !== "none") {
    const newNginxSiteId = await reconcileNginxSite(
      {
        id: finalDomain.id,
        name: finalDomain.name,
        aliases: jsonToStringArray(finalDomain.aliases),
        nginxSiteId: finalDomain.nginxSiteId ?? null,
        notes: payload.notes ?? null
      },
      payload
    );
    if (newNginxSiteId !== finalDomain.nginxSiteId) {
      await prisma.domain.update({ where: { id: finalDomain.id }, data: { nginxSiteId: newNginxSiteId } });
      const reloaded = await prisma.domain.findUnique({
        where: { id: finalDomain.id },
        include: { records: true, parentDomain: true }
      });
      if (reloaded) {
        finalDomain = reloaded;
      }
    }
  } else if (finalDomain.nginxSiteId) {
    await deleteNginxSite(finalDomain.nginxSiteId);
    await prisma.domain.update({ where: { id: finalDomain.id }, data: { nginxSiteId: null } });
    const reloaded = await prisma.domain.findUnique({
      where: { id: finalDomain.id },
      include: { records: true, parentDomain: true }
    });
    if (reloaded) {
      finalDomain = reloaded;
    }
  }

  await syncProviderRecords(buildProviderSyncContext(finalDomain));

  return mapDomainEntity(finalDomain);
};

export const deleteDomain = async (domainId: string): Promise<void> => {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) {
    return;
  }

  if (domain.nginxSiteId) {
    await deleteNginxSite(domain.nginxSiteId);
  }

  await prisma.domain.delete({ where: { id: domainId } });
};
