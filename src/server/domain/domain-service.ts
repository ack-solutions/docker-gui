import { z } from "zod";
import { getDataSource } from "@/server/database/data-source";
import { DomainEntity } from "@/server/domain/domain.entity";
import { DomainRecordEntity } from "@/server/domain/domain-record.entity";
import {
  createNginxSite,
  updateNginxSite,
  deleteNginxSite
} from "@/server/nginx/nginx-site-service";
import type { Domain, DomainDnsRecord, DomainTarget, DomainUpsertInput } from "@/types/server";

const domainNamePattern = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;
const urlPattern = /^https?:\/\//i;

const dnsRecordSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["A", "AAAA", "CNAME", "TXT", "MX", "SRV", "CAA", "NS"]),
  host: z.string().trim().min(1).max(255),
  value: z.string().trim().min(1).max(2048),
  ttl: z.number({ coerce: true }).int().positive().max(86_400).default(300),
  priority: z.number({ coerce: true }).int().positive().optional().nullable()
});

const domainModeSchema = z.enum(["external-dns", "pointer-only", "managed"]);

const domainTargetSchema = z
  .object({
    type: z.enum(["none", "container", "service", "external", "static"]).default("none"),
    containerId: z.string().trim().min(1).max(128).optional().nullable(),
    containerPort: z
      .number({ coerce: true })
      .int()
      .positive()
      .max(65535)
      .optional()
      .nullable(),
    serviceHost: z.string().trim().max(512).optional().nullable(),
    externalUrl: z.string().trim().max(2048).optional().nullable(),
    staticRoot: z.string().trim().max(1024).optional().nullable(),
    enableHttp: z.boolean().default(true),
    enableHttps: z.boolean().default(true),
    forceHttps: z.boolean().default(false),
    sslMode: z.enum(["none", "lets-encrypt", "custom"]).default("lets-encrypt"),
    letsEncryptEmail: z.string().email().optional().nullable(),
    sslCertificateId: z.string().trim().max(256).optional().nullable()
  })
  .superRefine((value, ctx) => {
    if (value.type === "container") {
      if (!value.containerId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["containerId"], message: "Container is required" });
      }
      if (!value.containerPort) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["containerPort"], message: "Port is required" });
      }
    }

    if (value.type === "service" && !value.serviceHost) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["serviceHost"], message: "Service host is required" });
    }

    if (value.type === "external") {
      if (!value.externalUrl) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["externalUrl"], message: "URL is required" });
      } else if (!urlPattern.test(value.externalUrl)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["externalUrl"], message: "Must start with http:// or https://" });
      }
    }

    if (value.type === "static" && (!value.staticRoot || value.staticRoot.trim().length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["staticRoot"], message: "Static directory is required" });
    }

    if (value.type !== "none" && value.enableHttps && value.sslMode === "lets-encrypt" && !value.letsEncryptEmail) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["letsEncryptEmail"], message: "Email is required for Let’s Encrypt" });
    }
  });

const domainInputSchema = z
  .object({
    name: z.string().trim().min(3).max(255).refine((value) => domainNamePattern.test(value), "Invalid domain name"),
    aliases: z.array(z.string().trim().min(1).max(255)).default([]),
    provider: z.string().trim().max(120).optional().nullable(),
    mode: domainModeSchema.optional(),
    managed: z.boolean().optional(),
    status: z.enum(["active", "pending", "error"]).default("pending"),
    notes: z.string().trim().max(2000).optional().nullable(),
    target: domainTargetSchema.default({
      type: "none",
      enableHttp: true,
      enableHttps: true,
      forceHttps: false,
      sslMode: "lets-encrypt"
    }),
    records: z.array(dnsRecordSchema).default([])
  })
  .superRefine((value, ctx) => {
    if (value.mode && value.managed !== undefined) {
      const expectedManaged = value.mode === "managed";
      if (value.managed !== expectedManaged) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["managed"],
          message: "Managed flag does not match selected domain mode"
        });
      }
    }
  })
  .transform((value) => {
    const resolvedMode =
      value.mode ??
      (value.managed === true ? "managed" : value.managed === false ? "external-dns" : "managed");

    const { managed: _legacyManaged, ...rest } = value;

    return {
      ...rest,
      mode: resolvedMode
    };
  });

const mapRecordEntity = (record: DomainRecordEntity): DomainDnsRecord => ({
  id: record.id,
  type: record.type,
  host: record.host,
  value: record.value,
  ttl: record.ttl,
  priority: record.priority ?? null,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString()
});

const mapTarget = (entity: DomainEntity): DomainTarget | null => {
  if (entity.targetType === "none") {
    return null;
  }

  return {
    type: entity.targetType,
    containerId: entity.targetContainerId ?? null,
    containerPort: entity.targetContainerPort ?? null,
    serviceHost: entity.targetServiceHost ?? null,
    externalUrl: entity.targetExternalUrl ?? null,
    staticRoot: entity.targetStaticRoot ?? null,
    enableHttp: entity.enableHttp,
    enableHttps: entity.enableHttps,
    forceHttps: entity.forceHttps,
    sslMode: entity.sslMode,
    letsEncryptEmail: entity.letsEncryptEmail ?? null,
    sslCertificateId: entity.sslCertificateId ?? null
  };
};

const mapDomainEntity = (entity: DomainEntity, records: DomainRecordEntity[]): Domain => ({
  id: entity.id,
  name: entity.name,
  aliases: entity.aliases ?? [],
  provider: entity.provider ?? null,
  mode: entity.mode,
  status: entity.status,
  notes: entity.notes ?? null,
  target: mapTarget(entity),
  nginxSiteId: entity.nginxSiteId ?? null,
  lastError: entity.lastError ?? null,
  createdAt: entity.createdAt.toISOString(),
  updatedAt: entity.updatedAt.toISOString(),
  records: records.map(mapRecordEntity)
});

const applyNginxMapping = async (entity: DomainEntity, payload: z.infer<typeof domainInputSchema>) => {
  const target = payload.target;
  if (!target || target.type === "none") {
    if (entity.nginxSiteId) {
      await deleteNginxSite(entity.nginxSiteId);
      entity.nginxSiteId = null;
    }
    return;
  }

  const serverNames = [entity.name, ...payload.aliases].filter(Boolean);

  const upstreamType =
    target.type === "container"
      ? "container"
      : target.type === "service"
        ? "service"
        : target.type === "external"
          ? "external"
          : target.type === "static"
            ? "static"
            : "container";

  const siteRequest = {
    primaryDomain: entity.name,
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
    extraDirectives: undefined
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

  if (entity.nginxSiteId) {
    const site = await updateNginxSite(entity.nginxSiteId, siteRequest);
    entity.nginxSiteId = site.id;
  } else {
    const site = await createNginxSite(siteRequest);
    entity.nginxSiteId = site.id;
  }
};

export const listDomains = async (): Promise<Domain[]> => {
  const dataSource = await getDataSource();
  const repo = dataSource.getRepository(DomainEntity);
  const domains = await repo.find({ relations: ["records"], order: { name: "ASC" } });
  return domains.map((domain) => mapDomainEntity(domain, domain.records ?? []));
};

export const getDomain = async (domainId: string): Promise<Domain | null> => {
  const dataSource = await getDataSource();
  const repo = dataSource.getRepository(DomainEntity);
  const domain = await repo.findOne({ where: { id: domainId }, relations: ["records"] });
  if (!domain) {
    return null;
  }
  return mapDomainEntity(domain, domain.records ?? []);
};

export const createDomain = async (input: DomainUpsertInput): Promise<Domain> => {
  const payload = domainInputSchema.parse(input);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const domainRepo = manager.getRepository(DomainEntity);
    const recordRepo = manager.getRepository(DomainRecordEntity);

    const domain = domainRepo.create({
      name: payload.name.toLowerCase(),
      aliases: Array.from(new Set(payload.aliases.map((alias) => alias.trim().toLowerCase()))),
      provider: payload.provider ?? null,
      mode: payload.mode,
      status: payload.status,
      notes: payload.notes ?? null,
      targetType: payload.target.type,
      targetContainerId: payload.target.containerId ?? null,
      targetContainerPort: payload.target.containerPort ?? null,
      targetServiceHost: payload.target.serviceHost ?? null,
      targetExternalUrl: payload.target.externalUrl ?? null,
      targetStaticRoot: payload.target.staticRoot ?? null,
      enableHttp: payload.target.enableHttp,
      enableHttps: payload.target.enableHttps,
      forceHttps: payload.target.forceHttps,
      sslMode: payload.target.sslMode,
      letsEncryptEmail: payload.target.letsEncryptEmail ?? null,
      sslCertificateId: payload.target.sslCertificateId ?? null
    });

    await domainRepo.save(domain);

    if (payload.records.length) {
      const recordEntities = payload.records.map((record) =>
        recordRepo.create({
          domainId: domain.id,
          type: record.type,
          host: record.host.trim(),
          value: record.value.trim(),
          ttl: record.ttl ?? 300,
          priority: record.priority ?? null
        })
      );
      await recordRepo.save(recordEntities);
      domain.records = recordEntities;
    } else {
      domain.records = [];
    }

    if (payload.target.type !== "none") {
      await applyNginxMapping(domain, payload);
      await domainRepo.save(domain);
    }

    const refreshed = await domainRepo.findOne({ where: { id: domain.id }, relations: ["records"] });
    if (!refreshed) {
      throw new Error("Failed to load domain after creation");
    }

    return mapDomainEntity(refreshed, refreshed.records ?? []);
  });
};

export const updateDomain = async (domainId: string, input: DomainUpsertInput): Promise<Domain> => {
  const payload = domainInputSchema.parse(input);
  const dataSource = await getDataSource();

  return dataSource.transaction(async (manager) => {
    const domainRepo = manager.getRepository(DomainEntity);
    const recordRepo = manager.getRepository(DomainRecordEntity);

    const domain = await domainRepo.findOne({ where: { id: domainId }, relations: ["records"] });
    if (!domain) {
      throw new Error("Domain not found");
    }

    domain.aliases = Array.from(new Set(payload.aliases.map((alias) => alias.trim().toLowerCase())));
    domain.provider = payload.provider ?? null;
    domain.mode = payload.mode;
    domain.status = payload.status;
    domain.notes = payload.notes ?? null;
    domain.targetType = payload.target.type;
    domain.targetContainerId = payload.target.containerId ?? null;
    domain.targetContainerPort = payload.target.containerPort ?? null;
    domain.targetServiceHost = payload.target.serviceHost ?? null;
    domain.targetExternalUrl = payload.target.externalUrl ?? null;
    domain.targetStaticRoot = payload.target.staticRoot ?? null;
    domain.enableHttp = payload.target.enableHttp;
    domain.enableHttps = payload.target.enableHttps;
    domain.forceHttps = payload.target.forceHttps;
    domain.sslMode = payload.target.sslMode;
    domain.letsEncryptEmail = payload.target.letsEncryptEmail ?? null;
    domain.sslCertificateId = payload.target.sslCertificateId ?? null;

    await domainRepo.save(domain);

    const existingRecords = domain.records ?? [];
    const incomingRecords = payload.records;

    const incomingIds = new Set(incomingRecords.map((record) => record.id).filter(Boolean) as string[]);

    for (const record of existingRecords) {
      if (!incomingIds.has(record.id)) {
        await recordRepo.delete(record.id);
      }
    }

    for (const record of incomingRecords) {
      if (record.id) {
        await recordRepo.update(record.id, {
          type: record.type,
          host: record.host.trim(),
          value: record.value.trim(),
          ttl: record.ttl ?? 300,
          priority: record.priority ?? null
        });
      } else {
        const newRecord = recordRepo.create({
          domainId: domain.id,
          type: record.type,
          host: record.host.trim(),
          value: record.value.trim(),
          ttl: record.ttl ?? 300,
          priority: record.priority ?? null
        });
        await recordRepo.save(newRecord);
      }
    }

    if (payload.target.type !== "none") {
      await applyNginxMapping(domain, payload);
      await domainRepo.save(domain);
    } else if (domain.nginxSiteId) {
      await deleteNginxSite(domain.nginxSiteId);
      domain.nginxSiteId = null;
      await domainRepo.save(domain);
    }

    const refreshed = await domainRepo.findOne({ where: { id: domain.id }, relations: ["records"] });
    if (!refreshed) {
      throw new Error("Failed to load domain after update");
    }

    return mapDomainEntity(refreshed, refreshed.records ?? []);
  });
};

export const deleteDomain = async (domainId: string): Promise<void> => {
  const dataSource = await getDataSource();
  const domainRepo = dataSource.getRepository(DomainEntity);
  const domain = await domainRepo.findOne({ where: { id: domainId } });
  if (!domain) {
    return;
  }

  if (domain.nginxSiteId) {
    await deleteNginxSite(domain.nginxSiteId);
  }

  await domainRepo.delete(domainId);
};
